"""
Provider latency stats — returns measured latency from real calls.

GET /latency/stats — aggregated latency per provider combo
GET /latency/providers — per-provider average latency
"""
from fastapi import APIRouter, Depends

from app.db import get_db
from app.auth import get_tenant_id

router = APIRouter(prefix="/latency", tags=["latency"])


@router.get("/stats")
async def get_latency_stats(tenant_id: str = Depends(get_tenant_id)):
    """Get aggregated latency stats from recent calls for this tenant."""
    db = get_db()
    result = (
        db.table("provider_latency")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return {"has_data": False, "stats": [], "providers": {}}

    # Aggregate per provider combo
    combos = {}
    provider_stats = {}  # per individual provider

    for row in rows:
        key = f"{row['stt_provider']}|{row['llm_provider']}|{row['tts_provider']}"
        if key not in combos:
            combos[key] = {"stt": row["stt_provider"], "llm": row["llm_provider"], "tts": row["tts_provider"],
                           "avg_ms": [], "p50_ms": [], "p95_ms": [], "calls": 0}
        combos[key]["avg_ms"].append(row["avg_ms"] or 0)
        combos[key]["p50_ms"].append(row["p50_ms"] or 0)
        combos[key]["p95_ms"].append(row["p95_ms"] or 0)
        combos[key]["calls"] += 1

        # Per-provider tracking
        for ptype in ["stt_provider", "llm_provider", "tts_provider"]:
            pname = row[ptype]
            if pname and pname not in provider_stats:
                provider_stats[pname] = {"avg_ms_values": [], "calls": 0, "type": ptype.replace("_provider", "")}
            if pname:
                provider_stats[pname]["avg_ms_values"].append(row["avg_ms"] or 0)
                provider_stats[pname]["calls"] += 1

    stats = []
    for combo in combos.values():
        n = len(combo["avg_ms"])
        stats.append({
            "stt": combo["stt"],
            "llm": combo["llm"],
            "tts": combo["tts"],
            "avg_ms": int(sum(combo["avg_ms"]) / n),
            "p50_ms": int(sum(combo["p50_ms"]) / n),
            "p95_ms": int(sum(combo["p95_ms"]) / n),
            "calls": combo["calls"],
        })

    providers = {}
    for pname, pdata in provider_stats.items():
        n = len(pdata["avg_ms_values"])
        providers[pname] = {
            "type": pdata["type"],
            "measured_avg_ms": int(sum(pdata["avg_ms_values"]) / n),
            "calls": pdata["calls"],
        }

    return {"has_data": True, "stats": stats, "providers": providers}


@router.get("/providers")
async def get_provider_latency():
    """Get global average latency per provider (across all tenants, last 500 calls)."""
    db = get_db()
    result = (
        db.table("provider_latency")
        .select("stt_provider, llm_provider, tts_provider, avg_ms")
        .order("created_at", desc=True)
        .limit(500)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return {"has_data": False, "providers": {}}

    provider_stats = {}
    for row in rows:
        for ptype in ["stt_provider", "llm_provider", "tts_provider"]:
            pname = row[ptype]
            if pname:
                if pname not in provider_stats:
                    provider_stats[pname] = {"values": [], "type": ptype.replace("_provider", "")}
                provider_stats[pname]["values"].append(row["avg_ms"] or 0)

    providers = {}
    for pname, pdata in provider_stats.items():
        n = len(pdata["values"])
        providers[pname] = {
            "type": pdata["type"],
            "measured_avg_ms": int(sum(pdata["values"]) / n),
            "calls": n,
        }

    return {"has_data": True, "providers": providers}
