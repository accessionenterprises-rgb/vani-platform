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

# ── Pricing: Option C — Platform fee + Provider markup ────────────────────────
# Platform fee: ₹1.00/min ($0.012/min)
# Provider markup: 1.5x actual cost (telephony, STT, TTS), 2x (LLM)
PLATFORM_FEE_PER_MIN = 0.012  # ~₹1.00

# Actual provider costs (USD/min) — what WE pay
_ACTUAL_COSTS = {
    # Telephony
    "twilio":          0.013,
    "exotel":          0.0024,
    # STT
    "deepgram":        0.006,
    "deepgram-nova-3": 0.006,
    # LLM (2x markup)
    "groq":            0.001,
    "llama-3.3-70b":   0.001,
    "gpt-4o-mini":     0.005,
    "gpt-4.1-mini":    0.005,
    "gpt-5-mini":      0.008,
    "gemini-2.0-flash": 0.003,
    # TTS
    "openai":          0.008,   # ₹0.70/min
    "sarvam":          0.010,   # ₹0.83/min (Bulbul v2)
    "sarvam-v3":       0.020,   # ₹1.65/min (Bulbul v3)
    "cartesia":        0.036,   # ₹3.00/min
    "elevenlabs":      0.048,   # ₹4.07/min
}

# Markup multipliers
_MARKUP = {
    "telephony": 1.5,
    "stt":       1.5,
    "llm":       2.0,
    "tts":       1.5,
}

def _customer_rate(provider: str, provider_type: str) -> float:
    """What the CUSTOMER pays per minute (actual cost × markup + platform fee share)."""
    actual = _actual_rate(provider)
    markup = _MARKUP.get(provider_type, 1.5)
    return actual * markup

def _actual_rate(provider: str) -> float:
    """What WE pay per minute for this provider."""
    if not provider:
        return 0.0
    key = provider.lower().strip()
    if key in _ACTUAL_COSTS:
        return _ACTUAL_COSTS[key]
    for k, v in _ACTUAL_COSTS.items():
        if k in key or key in k:
            return v
    return 0.0

# Keep old name for backwards compat
PROVIDER_RATES = _ACTUAL_COSTS


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
    platform: float
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

    # Cost breakdown — customer-facing (with markup)
    platform_cost = 0.0
    telephony_cost = 0.0
    stt_cost = 0.0
    llm_cost = 0.0
    tts_cost = 0.0
    daily_map: dict[str, dict] = {}

    for r in rows:
        dur_min = (r.get("duration_sec") or 0) / 60

        # Platform fee
        call_platform = dur_min * PLATFORM_FEE_PER_MIN
        platform_cost += call_platform

        # Telephony (1.5x markup)
        call_telephony = dur_min * _customer_rate("twilio", "telephony")
        telephony_cost += call_telephony

        # STT (1.5x markup)
        call_stt = dur_min * _customer_rate(r.get("stt_provider") or "deepgram", "stt")
        stt_cost += call_stt

        # LLM (2x markup)
        call_llm = dur_min * _customer_rate(r.get("llm_provider") or "groq", "llm")
        llm_cost += call_llm

        # TTS (1.5x markup)
        call_tts = dur_min * _customer_rate(r.get("tts_provider") or "openai", "tts")
        tts_cost += call_tts

        # Daily bucket
        day = (r.get("created_at") or "")[:10]
        if day:
            if day not in daily_map:
                daily_map[day] = {"date": day, "calls": 0, "minutes": 0.0, "cost": 0.0}
            daily_map[day]["calls"] += 1
            daily_map[day]["minutes"] = round(daily_map[day]["minutes"] + dur_min, 2)
            daily_map[day]["cost"] = round(
                daily_map[day]["cost"] + call_platform + call_telephony + call_stt + call_llm + call_tts, 4
            )

    total_cost = round(platform_cost + telephony_cost + stt_cost + llm_cost + tts_cost, 4)
    effective_rate = round(total_cost / total_minutes, 4) if total_minutes > 0 else 0.0

    return UsageResponse(
        period_start=month_start,
        period_end=now,
        total_calls=total_calls,
        total_minutes=total_minutes,
        cost_breakdown=CostBreakdown(
            platform=round(platform_cost, 4),
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
    """Public pricing — shows per-minute cost for each provider combination."""
    stacks = [
        {
            "name": "Standard",
            "description": "Sarvam v2 + Groq — best for India",
            "tts": "sarvam", "llm": "llama-3.3-70b", "stt": "deepgram-nova-3",
            "telephony": "twilio",
        },
        {
            "name": "Standard (Exotel)",
            "description": "Sarvam v2 + Groq + Exotel — cheapest India",
            "tts": "sarvam", "llm": "llama-3.3-70b", "stt": "deepgram-nova-3",
            "telephony": "exotel",
        },
        {
            "name": "Global",
            "description": "OpenAI Nova + Groq — best for international",
            "tts": "openai", "llm": "llama-3.3-70b", "stt": "deepgram-nova-3",
            "telephony": "twilio",
        },
        {
            "name": "Premium",
            "description": "Cartesia Brooke + Groq — best voice quality",
            "tts": "cartesia", "llm": "llama-3.3-70b", "stt": "deepgram-nova-3",
            "telephony": "twilio",
        },
        {
            "name": "Ultra",
            "description": "ElevenLabs + Groq — most expressive",
            "tts": "elevenlabs", "llm": "llama-3.3-70b", "stt": "deepgram-nova-3",
            "telephony": "twilio",
        },
    ]
    result = []
    for s in stacks:
        platform = PLATFORM_FEE_PER_MIN
        telephony = _customer_rate(s["telephony"], "telephony")
        stt = _customer_rate(s["stt"], "stt")
        llm = _customer_rate(s["llm"], "llm")
        tts = _customer_rate(s["tts"], "tts")
        total = platform + telephony + stt + llm + tts
        result.append({
            "name": s["name"],
            "description": s["description"],
            "per_minute_usd": round(total, 4),
            "per_minute_inr": round(total * 84, 2),
            "breakdown": {
                "platform": round(platform, 4),
                "telephony": round(telephony, 4),
                "stt": round(stt, 4),
                "llm": round(llm, 4),
                "tts": round(tts, 4),
            },
        })
    return {"plans": [
        {"name": "Starter", "price_monthly": 0, "included_minutes": 50, "overage_rate": "per stack"},
        {"name": "Growth", "price_monthly": 4999, "currency": "INR", "included_minutes": 1000, "overage_rate": "per stack"},
        {"name": "Business", "price_monthly": 14999, "currency": "INR", "included_minutes": 5000, "overage_rate": "per stack"},
        {"name": "Enterprise", "price_monthly": "custom", "included_minutes": "unlimited"},
    ], "stacks": result}


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
