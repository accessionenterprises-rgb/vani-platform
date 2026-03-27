"""
Billing endpoints — usage tracking, invoices, plan management.

GET /billing/usage     — current month usage (minutes, calls, cost breakdown)
GET /billing/invoices  — past invoices
GET /billing/plan      — current plan + limits
POST /billing/upgrade  — upgrade plan (stub)
"""
from datetime import datetime, timezone
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.db import get_db
from app.middleware.auth import get_tenant_id

logger = structlog.get_logger()

router = APIRouter(prefix="/billing", tags=["Billing"])

# ── Pricing: Engine fee (auto-tiered by provider selection) ───────────────────
# Engine fee per minute — determined by the most expensive provider in the stack
# ₹1.00/min ($0.0105) — cheap providers (Groq, Sarvam v2, Deepgram)
# ₹1.50/min ($0.0158) — mid providers (GPT-4o-mini, DeepSeek, Sarvam v3, OpenAI TTS)
# ₹2.00/min ($0.0211) — premium providers (Cartesia, ElevenLabs, GPT-5)

_ENGINE_FEE_TIERS = {
    "cheap":   0.0105,  # ₹1.00/min
    "mid":     0.0158,  # ₹1.50/min
    "premium": 0.0211,  # ₹2.00/min
}

# Provider → tier mapping
_PROVIDER_TIER = {
    # Cheap
    "groq": "cheap", "llama-3.3-70b": "cheap", "llama-3.1-8b": "cheap",
    "gemma2-9b": "cheap", "deepgram": "cheap", "deepgram-nova-3": "cheap",
    "sarvam": "cheap", "twilio": "cheap", "exotel": "cheap",
    # Mid
    "gpt-4o-mini": "mid", "gpt-4.1-mini": "mid", "gpt-4.1-nano": "mid",
    "gemini-2.0-flash": "mid", "deepseek-chat": "mid",
    "sarvam-v3": "mid", "openai": "mid",
    # Premium
    "gpt-5-mini": "premium", "gpt-5": "premium", "gpt-5.4": "premium",
    "gpt-4o": "premium", "gpt-4.1": "premium",
    "cartesia": "premium", "elevenlabs": "premium",
    "claude-haiku": "premium", "claude-sonnet": "premium",
    "mistral-large": "premium",
}

def _get_engine_fee(llm: str = "", tts: str = "", stt: str = "") -> float:
    """Determine engine fee based on highest-tier provider in the stack."""
    tier_order = {"cheap": 0, "mid": 1, "premium": 2}
    max_tier = "cheap"
    for provider in [llm, tts, stt]:
        if not provider:
            continue
        key = provider.lower().strip()
        t = _PROVIDER_TIER.get(key)
        if not t:
            for k, v in _PROVIDER_TIER.items():
                if k in key or key in k:
                    t = v
                    break
        if t and tier_order.get(t, 0) > tier_order.get(max_tier, 0):
            max_tier = t
    return _ENGINE_FEE_TIERS[max_tier]

# Actual provider costs (USD/min) — pass-through at cost
PROVIDER_RATES = {
    # Telephony
    "twilio":          0.013,
    "exotel":          0.0024,
    # STT
    "deepgram":        0.006,
    "deepgram-nova-3": 0.006,
    # LLM
    "groq":            0.001,
    "llama-3.3-70b":   0.001,
    "gpt-4o-mini":     0.005,
    "gpt-4.1-mini":    0.005,
    "gpt-5-mini":      0.008,
    "gemini-2.0-flash": 0.003,
    "deepseek-chat":   0.004,
    # TTS
    "openai":          0.008,
    "sarvam":          0.010,
    "sarvam-v3":       0.020,
    "cartesia":        0.036,
    "elevenlabs":      0.048,
}

def _provider_rate(provider: str) -> float:
    """What the provider actually costs per minute (pass-through)."""
    if not provider:
        return 0.0
    key = provider.lower().strip()
    if key in PROVIDER_RATES:
        return PROVIDER_RATES[key]
    for k, v in PROVIDER_RATES.items():
        if k in key or key in k:
            return v
    return 0.0


def _current_month_range() -> tuple[str, str]:
    """Return ISO strings for the first instant of this month and now."""
    now = datetime.now(timezone.utc)
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return start.isoformat(), now.isoformat()


def _rate(provider: Optional[str]) -> float:
    """Look up per-minute rate for a provider string, with fuzzy matching."""
    if not provider:
        return 0.0
    key = provider.lower().strip()
    if key in PROVIDER_RATES:
        return PROVIDER_RATES[key]
    # Fuzzy: check if any known key is a prefix/substring
    for k, v in PROVIDER_RATES.items():
        if k in key or key in k:
            return v
    return 0.0


# ── Response models ──────────────────────────────────────────────────────────

class CostBreakdown(BaseModel):
    engine_fee: float
    telephony: float
    stt: float
    llm: float
    tts: float
    total: float


class UsageResponse(BaseModel):
    period_start: str
    period_end: str
    total_calls: int
    total_minutes: float
    cost_breakdown: CostBreakdown
    effective_rate_per_min: float
    daily: list[dict]


class PlanResponse(BaseModel):
    plan: str
    price_monthly: float
    included_minutes: int
    per_minute_overage: float
    minutes_used: float
    minutes_remaining: float
    overage_cost: float
    features: dict


class InvoiceResponse(BaseModel):
    model_config = {"extra": "ignore"}
    id: str
    tenant_id: str
    period_start: str
    period_end: str
    total_amount: float
    status: str
    line_items: list[dict]
    created_at: Optional[str] = None


class UpgradeRequest(BaseModel):
    plan: str  # "starter" | "growth" | "business"


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/usage", response_model=UsageResponse)
async def get_usage(tenant_id: str = Depends(get_tenant_id)):
    """Current month usage: minutes, calls, cost breakdown by provider type."""
    db = get_db()
    month_start, now = _current_month_range()

    result = (
        db.table("calls")
        .select("duration_sec, stt_provider, llm_provider, tts_provider, created_at")
        .eq("tenant_id", tenant_id)
        .gte("created_at", month_start)
        .execute()
    )
    rows = result.data or []

    total_calls = len(rows)
    total_seconds = sum(r.get("duration_sec") or 0 for r in rows)
    total_minutes = round(total_seconds / 60, 2)

    # Cost breakdown — providers at cost + engine fee
    engine_cost = 0.0
    telephony_cost = 0.0
    stt_cost = 0.0
    llm_cost = 0.0
    tts_cost = 0.0
    daily_map: dict[str, dict] = {}

    for r in rows:
        dur_min = (r.get("duration_sec") or 0) / 60
        r_llm = r.get("llm_provider") or "groq"
        r_tts = r.get("tts_provider") or "openai"
        r_stt = r.get("stt_provider") or "deepgram"

        # Engine fee (auto-tiered by providers)
        call_engine = dur_min * _get_engine_fee(r_llm, r_tts, r_stt)
        engine_cost += call_engine

        # Providers at cost (pass-through)
        call_telephony = dur_min * _provider_rate("twilio")
        telephony_cost += call_telephony

        call_stt = dur_min * _provider_rate(r_stt)
        stt_cost += call_stt

        call_llm = dur_min * _provider_rate(r_llm)
        llm_cost += call_llm

        call_tts = dur_min * _provider_rate(r_tts)
        tts_cost += call_tts

        # Daily bucket
        day = (r.get("created_at") or "")[:10]
        if day:
            if day not in daily_map:
                daily_map[day] = {"date": day, "calls": 0, "minutes": 0.0, "cost": 0.0}
            daily_map[day]["calls"] += 1
            daily_map[day]["minutes"] = round(daily_map[day]["minutes"] + dur_min, 2)
            daily_map[day]["cost"] = round(
                daily_map[day]["cost"] + call_engine + call_telephony + call_stt + call_llm + call_tts, 4
            )

    total_cost = round(engine_cost + telephony_cost + stt_cost + llm_cost + tts_cost, 4)
    effective_rate = round(total_cost / total_minutes, 4) if total_minutes > 0 else 0.0

    return UsageResponse(
        period_start=month_start,
        period_end=now,
        total_calls=total_calls,
        total_minutes=total_minutes,
        cost_breakdown=CostBreakdown(
            engine_fee=round(engine_cost, 4),
            telephony=round(telephony_cost, 4),
            stt=round(stt_cost, 4),
            llm=round(llm_cost, 4),
            tts=round(tts_cost, 4),
            total=total_cost,
        ),
        effective_rate_per_min=effective_rate,
        daily=sorted(daily_map.values(), key=lambda x: x["date"]),
    )


@router.get("/invoices", response_model=list[InvoiceResponse])
async def list_invoices(
    limit: int = Query(12, le=50),
    tenant_id: str = Depends(get_tenant_id),
):
    """Past invoices for the tenant."""
    db = get_db()
    result = (
        db.table("invoices")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("period_end", desc=True)
        .limit(limit)
        .execute()
    )
    return [
        InvoiceResponse(
            id=str(r["id"]),
            tenant_id=r["tenant_id"],
            period_start=str(r["period_start"]),
            period_end=str(r["period_end"]),
            total_amount=float(r["total_amount"]),
            status=r["status"],
            line_items=r.get("line_items") or [],
            created_at=str(r["created_at"]) if r.get("created_at") else None,
        )
        for r in (result.data or [])
    ]


@router.get("/plan", response_model=PlanResponse)
async def get_plan(tenant_id: str = Depends(get_tenant_id)):
    """Current plan details + usage against limits."""
    db = get_db()

    # Get tenant plan slug
    tenant = (
        db.table("tenants")
        .select("plan")
        .eq("id", tenant_id)
        .maybe_single()
        .execute()
    )
    plan_slug = (tenant.data or {}).get("plan", "starter")

    # Look up plan details
    plan_row = (
        db.table("plans")
        .select("*")
        .eq("name", plan_slug)
        .maybe_single()
        .execute()
    )

    if plan_row.data:
        p = plan_row.data
        price = float(p["price_monthly"])
        included = int(p["included_minutes"])
        overage_rate = float(p["per_minute_overage"])
        features = p.get("features") or {}
    else:
        # Fallback defaults if plans table not populated yet
        defaults = {
            "starter":  (0,    100,  0.10, {}),
            "growth":   (49,   1000, 0.05, {}),
            "business": (199,  5000, 0.03, {}),
        }
        price, included, overage_rate, features = defaults.get(
            plan_slug, (0, 100, 0.10, {})
        )

    # Current month usage
    month_start, _ = _current_month_range()
    usage = (
        db.table("calls")
        .select("duration_sec")
        .eq("tenant_id", tenant_id)
        .gte("created_at", month_start)
        .execute()
    )
    total_sec = sum(r.get("duration_sec") or 0 for r in (usage.data or []))
    minutes_used = round(total_sec / 60, 2)
    remaining = max(0, included - minutes_used)
    overage = max(0, minutes_used - included) * overage_rate

    return PlanResponse(
        plan=plan_slug,
        price_monthly=price,
        included_minutes=included,
        per_minute_overage=overage_rate,
        minutes_used=minutes_used,
        minutes_remaining=round(remaining, 2),
        overage_cost=round(overage, 4),
        features=features,
    )


@router.get("/pricing")
async def get_pricing():
    """Public pricing — engine fee + provider costs at pass-through rates."""
    INR = 95

    stacks = [
        {"name": "Standard India", "desc": "Groq + Sarvam v2 + Exotel", "llm": "llama-3.3-70b", "tts": "sarvam", "stt": "deepgram-nova-3", "tel": "exotel"},
        {"name": "Standard Global", "desc": "Groq + Sarvam v2 + Twilio", "llm": "llama-3.3-70b", "tts": "sarvam", "stt": "deepgram-nova-3", "tel": "twilio"},
        {"name": "Mid-Range", "desc": "GPT-4o-mini + OpenAI TTS", "llm": "gpt-4o-mini", "tts": "openai", "stt": "deepgram-nova-3", "tel": "twilio"},
        {"name": "Premium", "desc": "Groq + Cartesia Brooke", "llm": "llama-3.3-70b", "tts": "cartesia", "stt": "deepgram-nova-3", "tel": "twilio"},
        {"name": "Ultra", "desc": "Groq + ElevenLabs", "llm": "llama-3.3-70b", "tts": "elevenlabs", "stt": "deepgram-nova-3", "tel": "twilio"},
    ]

    result = []
    for s in stacks:
        engine = _get_engine_fee(s["llm"], s["tts"], s["stt"])
        tel = _provider_rate(s["tel"])
        stt = _provider_rate(s["stt"])
        llm = _provider_rate(s["llm"])
        tts = _provider_rate(s["tts"])
        total = engine + tel + stt + llm + tts
        result.append({
            "name": s["name"],
            "description": s["desc"],
            "per_minute_usd": round(total, 4),
            "per_minute_inr": round(total * INR, 2),
            "breakdown": {
                "engine_fee": round(engine, 4),
                "engine_fee_inr": round(engine * INR, 2),
                "telephony": round(tel, 4),
                "stt": round(stt, 4),
                "llm": round(llm, 4),
                "tts": round(tts, 4),
            },
        })

    return {
        "engine_fee_tiers": {
            "cheap": {"fee_usd": 0.0105, "fee_inr": round(0.0105 * INR, 2), "providers": "Groq, Sarvam v2, Deepgram, Exotel"},
            "mid": {"fee_usd": 0.0158, "fee_inr": round(0.0158 * INR, 2), "providers": "GPT-4o-mini, DeepSeek, Sarvam v3, OpenAI TTS, Gemini Flash"},
            "premium": {"fee_usd": 0.0211, "fee_inr": round(0.0211 * INR, 2), "providers": "Cartesia, ElevenLabs, GPT-5, Claude"},
        },
        "note": "Engine fee is auto-determined by the highest-tier provider in your stack. Provider costs are pass-through at actual rates. Connect your own provider keys (BYOK) to pay $0 for that component.",
        "stacks": result,
    }


@router.post("/upgrade")
async def upgrade_plan(
    body: UpgradeRequest,
    tenant_id: str = Depends(get_tenant_id),
):
    """Upgrade tenant plan (stub — will integrate payment gateway later)."""
    valid_plans = {"starter", "growth", "business"}
    if body.plan not in valid_plans:
        raise HTTPException(status_code=400, detail=f"Invalid plan. Choose from: {', '.join(sorted(valid_plans))}")

    db = get_db()

    # Check current plan
    tenant = (
        db.table("tenants")
        .select("plan")
        .eq("id", tenant_id)
        .maybe_single()
        .execute()
    )
    current = (tenant.data or {}).get("plan", "starter")
    if current == body.plan:
        raise HTTPException(status_code=400, detail=f"Already on the {body.plan} plan")

    # Update tenant plan
    db.table("tenants").update({"plan": body.plan}).eq("id", tenant_id).execute()

    logger.info("plan_upgraded", tenant_id=tenant_id, from_plan=current, to_plan=body.plan)

    return {
        "ok": True,
        "previous_plan": current,
        "new_plan": body.plan,
        "message": f"Upgraded to {body.plan}. Payment integration coming soon.",
    }
