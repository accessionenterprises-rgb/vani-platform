"""
Analytics endpoints.

GET /analytics/overview   — KPI cards for the period
GET /analytics/calls      — call volume + outcome over time
GET /analytics/agents     — per-agent performance
GET /analytics/latency    — avg duration / turn count
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, Query

from app.db import get_db
from app.middleware.auth import get_tenant_id

logger = structlog.get_logger()

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _period_start(days: int) -> str:
    dt = datetime.now(timezone.utc) - timedelta(days=days)
    return dt.isoformat()


@router.get("/overview")
async def overview(
    period: int = Query(7, description="Days back"),
    tenant_id: str = Depends(get_tenant_id),
):
    """KPI cards: total calls, completed, failed, avg duration, sentiment breakdown."""
    db = get_db()
    since = _period_start(period)

    result = (
        db.table("calls")
        .select("status, duration_sec, sentiment, direction")
        .eq("tenant_id", tenant_id)
        .gte("created_at", since)
        .execute()
    )
    rows = result.data or []

    total = len(rows)
    completed = sum(1 for r in rows if r["status"] == "completed")
    failed = sum(1 for r in rows if r["status"] == "failed")
    active = sum(1 for r in rows if r["status"] == "active")
    inbound = sum(1 for r in rows if r["direction"] == "inbound")
    outbound = sum(1 for r in rows if r["direction"] == "outbound")

    durations = [r["duration_sec"] for r in rows if r.get("duration_sec")]
    avg_duration = int(sum(durations) / len(durations)) if durations else 0
    max_duration = max(durations) if durations else 0

    sentiments = {}
    for r in rows:
        s = r.get("sentiment") or "unknown"
        sentiments[s] = sentiments.get(s, 0) + 1

    success_rate = round((completed / total * 100) if total else 0, 1)

    return {
        "period_days": period,
        "total_calls": total,
        "completed": completed,
        "failed": failed,
        "active_now": active,
        "inbound": inbound,
        "outbound": outbound,
        "avg_duration_sec": avg_duration,
        "max_duration_sec": max_duration,
        "success_rate": success_rate,
        "sentiment_breakdown": sentiments,
    }


@router.get("/calls")
async def calls_over_time(
    period: int = Query(7, description="Days back"),
    tenant_id: str = Depends(get_tenant_id),
):
    """Daily call volume + outcome breakdown for charting."""
    db = get_db()
    since = _period_start(period)

    result = (
        db.table("calls")
        .select("status, direction, created_at")
        .eq("tenant_id", tenant_id)
        .gte("created_at", since)
        .order("created_at")
        .execute()
    )
    rows = result.data or []

    # Group by date
    daily: dict[str, dict] = {}
    for r in rows:
        dt = r["created_at"][:10]  # YYYY-MM-DD
        if dt not in daily:
            daily[dt] = {"date": dt, "total": 0, "completed": 0, "failed": 0, "inbound": 0, "outbound": 0}
        daily[dt]["total"] += 1
        if r["status"] == "completed":
            daily[dt]["completed"] += 1
        elif r["status"] == "failed":
            daily[dt]["failed"] += 1
        if r["direction"] == "inbound":
            daily[dt]["inbound"] += 1
        else:
            daily[dt]["outbound"] += 1

    # Fill missing days with zeros
    chart = []
    for i in range(period):
        day = (datetime.now(timezone.utc) - timedelta(days=period - 1 - i)).strftime("%Y-%m-%d")
        chart.append(daily.get(day, {
            "date": day, "total": 0, "completed": 0, "failed": 0, "inbound": 0, "outbound": 0
        }))

    return {"chart": chart}


@router.get("/agents")
async def agent_performance(
    period: int = Query(7, description="Days back"),
    tenant_id: str = Depends(get_tenant_id),
):
    """Per-agent: call count, completion rate, avg duration, dominant sentiment."""
    db = get_db()
    since = _period_start(period)

    calls_result = (
        db.table("calls")
        .select("agent_id, status, duration_sec, sentiment")
        .eq("tenant_id", tenant_id)
        .gte("created_at", since)
        .not_.is_("agent_id", "null")
        .execute()
    )

    agents_result = (
        db.table("agents")
        .select("id, name")
        .eq("tenant_id", tenant_id)
        .execute()
    )

    agent_map = {str(a["id"]): a["name"] for a in (agents_result.data or [])}

    # Aggregate per agent
    stats: dict[str, dict] = {}
    for r in (calls_result.data or []):
        aid = str(r["agent_id"])
        if aid not in stats:
            stats[aid] = {
                "agent_id": aid,
                "agent_name": agent_map.get(aid, "Unknown"),
                "total": 0, "completed": 0, "failed": 0,
                "durations": [], "sentiments": {}
            }
        stats[aid]["total"] += 1
        if r["status"] == "completed":
            stats[aid]["completed"] += 1
        elif r["status"] == "failed":
            stats[aid]["failed"] += 1
        if r.get("duration_sec"):
            stats[aid]["durations"].append(r["duration_sec"])
        s = r.get("sentiment") or "unknown"
        stats[aid]["sentiments"][s] = stats[aid]["sentiments"].get(s, 0) + 1

    result = []
    for aid, s in stats.items():
        durs = s.pop("durations")
        sents = s.pop("sentiments")
        dominant = max(sents, key=sents.get) if sents else "unknown"
        s["avg_duration_sec"] = int(sum(durs) / len(durs)) if durs else 0
        s["success_rate"] = round((s["completed"] / s["total"] * 100) if s["total"] else 0, 1)
        s["dominant_sentiment"] = dominant
        result.append(s)

    return {"agents": sorted(result, key=lambda x: x["total"], reverse=True)}


@router.get("/providers")
async def provider_performance(
    period: int = Query(7, description="Days back"),
    tenant_id: str = Depends(get_tenant_id),
):
    """Per-provider latency + cost aggregates from completed calls."""
    db = get_db()
    since = _period_start(period)

    result = (
        db.table("calls")
        .select("llm_provider, stt_provider, tts_provider, duration_sec, metadata")
        .eq("tenant_id", tenant_id)
        .eq("status", "completed")
        .gte("created_at", since)
        .not_.is_("duration_sec", "null")
        .execute()
    )
    rows = result.data or []

    llm_stats: dict[str, dict] = {}
    tts_stats: dict[str, dict] = {}
    stt_stats: dict[str, dict] = {}

    def _bucket(stats, key, row, latency_key):
        if not key:
            return
        if key not in stats:
            stats[key] = {"calls": 0, "total_latency": 0, "total_cost": 0.0}
        stats[key]["calls"] += 1
        meta = row.get("metadata") or {}
        latency = (meta.get("latency_profile") or {}).get(latency_key, 0)
        stats[key]["total_latency"] += latency
        stats[key]["total_cost"] += (meta.get("cost") or {}).get(f"{latency_key.split('_')[0]}_usd", 0.0)

    for r in rows:
        _bucket(llm_stats, r.get("llm_provider"), r, "llm_first_token_ms")
        _bucket(tts_stats, r.get("tts_provider"), r, "tts_first_chunk_ms")
        _bucket(stt_stats, r.get("stt_provider"), r, "stt_latency_ms")

    def _fmt(stats, provider_type):
        out = []
        for name, s in stats.items():
            n = s["calls"]
            out.append({
                "provider": name,
                "type": provider_type,
                "calls": n,
                "avg_latency_ms": round(s["total_latency"] / n) if n else 0,
                "total_cost_usd": round(s["total_cost"], 4),
            })
        return sorted(out, key=lambda x: x["calls"], reverse=True)

    return {
        "llm":  _fmt(llm_stats, "llm"),
        "tts":  _fmt(tts_stats, "tts"),
        "stt":  _fmt(stt_stats, "stt"),
        "total_calls": len(rows),
    }


@router.get("/intents")
async def intent_breakdown(
    period: int = Query(7, description="Days back"),
    tenant_id: str = Depends(get_tenant_id),
):
    """Intent distribution from post-processor metadata."""
    db = get_db()
    since = _period_start(period)

    result = (
        db.table("calls")
        .select("metadata")
        .eq("tenant_id", tenant_id)
        .eq("status", "completed")
        .gte("created_at", since)
        .execute()
    )

    intents: dict[str, int] = {}
    resolved_count = 0
    escalated_count = 0

    for r in (result.data or []):
        meta = r.get("metadata") or {}
        intent = meta.get("intent") or "unknown"
        intents[intent] = intents.get(intent, 0) + 1
        if meta.get("resolved"):
            resolved_count += 1
        if meta.get("escalated"):
            escalated_count += 1

    total = sum(intents.values())
    return {
        "intents": [
            {"label": k, "count": v, "pct": round(v / total * 100, 1) if total else 0}
            for k, v in sorted(intents.items(), key=lambda x: x[1], reverse=True)
        ],
        "resolved": resolved_count,
        "escalated": escalated_count,
    }
