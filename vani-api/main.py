"""Vani API — entrypoint."""
import asyncio
from pathlib import Path

import structlog
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.config import settings
from app.routers import admin, agent_builder, agents, analytics, api_keys, auth, billing, calls, campaigns, dialer, dnc, kb, latency, number_hunter, numbers, outbound, playground_chat, playground_voice, products, qa_tester, qa_reports, team, telephony, tools, tts_preview, webhook_config, webhooks, widget
from app.middleware.usage import UsageMeteringMiddleware, periodic_flush
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.errors import install_error_handlers

logger = structlog.get_logger()

app = FastAPI(
    title="Vani API",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(UsageMeteringMiddleware)
app.add_middleware(RateLimitMiddleware, redis_url=getattr(settings, "redis_url", None))
install_error_handlers(app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins — widget embed needs cross-origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Public API routes (versioned /v1/) ────────────────────────────────────────
V1 = "/v1"
app.include_router(auth.router,             prefix=V1)
app.include_router(agents.router,           prefix=V1)
app.include_router(kb.router,               prefix=V1)
app.include_router(tools.router,            prefix=V1)
app.include_router(products.router,         prefix=V1)
app.include_router(calls.router,            prefix=V1)
app.include_router(outbound.router,         prefix=V1)
app.include_router(campaigns.router,        prefix=V1)
app.include_router(analytics.router,        prefix=V1)
app.include_router(api_keys.router,         prefix=V1)
app.include_router(numbers.router,          prefix=V1)
app.include_router(number_hunter.router,    prefix=V1)
app.include_router(webhooks.router,         prefix=V1)
app.include_router(webhook_config.router,   prefix=V1)
app.include_router(dnc.router,              prefix=V1)
app.include_router(dialer.router,           prefix=V1)
app.include_router(team.router,             prefix=V1)
app.include_router(agent_builder.router,    prefix=V1)
app.include_router(tts_preview.router,      prefix=V1)
app.include_router(playground_chat.router,  prefix=V1)
app.include_router(playground_voice.router, prefix=V1)
app.include_router(qa_tester.router,        prefix=V1)
app.include_router(qa_reports.router,       prefix=V1)
app.include_router(latency.router,          prefix=V1)
app.include_router(billing.router,          prefix=V1)

# ── Backwards compatibility — mount same routes without /v1/ prefix ──────────
# Dashboard and existing integrations use unprefixed routes.
# Remove these once dashboard is updated to use /v1/.
app.include_router(auth.router)
app.include_router(agents.router)
app.include_router(kb.router)
app.include_router(tools.router)
app.include_router(products.router)
app.include_router(calls.router)
app.include_router(outbound.router)
app.include_router(campaigns.router)
app.include_router(analytics.router)
app.include_router(api_keys.router)
app.include_router(numbers.router)
app.include_router(number_hunter.router)
app.include_router(webhooks.router)
app.include_router(webhook_config.router)
app.include_router(dnc.router)
app.include_router(dialer.router)
app.include_router(team.router)
app.include_router(agent_builder.router)
app.include_router(tts_preview.router)
app.include_router(playground_chat.router)
app.include_router(playground_voice.router)
app.include_router(qa_tester.router)
app.include_router(qa_reports.router)
app.include_router(latency.router)
app.include_router(billing.router)

# ── Internal routes (no versioning) ──────────────────────────────────────────
app.include_router(admin.router)
app.include_router(widget.router)
app.include_router(telephony.router)

STATIC_DIR = Path(__file__).parent / "static"

from fastapi.staticfiles import StaticFiles
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/widget/embed.js", include_in_schema=False)
async def serve_embed_js():
    return FileResponse(STATIC_DIR / "embed.js", media_type="application/javascript",
                        headers={"Cache-Control": "public, max-age=3600"})


@app.on_event("startup")
async def start_number_hunter_scheduler() -> None:
    """Clean up stale scans and launch background schedulers."""
    # Mark old 'running' scans as failed — but only if started >10 min ago
    # (recent ones might have been started just before this deploy)
    try:
        from app.db import get_db as _get_db
        from datetime import datetime, timezone, timedelta
        db = _get_db()
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
        stale = (
            db.table("number_scan_runs")
            .select("id")
            .eq("status", "running")
            .lt("started_at", cutoff)
            .execute().data or []
        )
        if stale:
            for row in stale:
                db.table("number_scan_runs").update({
                    "status": "failed",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "error": "Scan interrupted by server restart",
                }).eq("id", row["id"]).execute()
            logger.info("Marked %d stale scan(s) as failed on startup", len(stale))
    except Exception as exc:
        logger.warning("Stale scan cleanup failed: %s", exc)

    asyncio.create_task(_hunter_scheduler())
    asyncio.create_task(_schedule_checker())
    asyncio.create_task(periodic_flush())


async def _hunter_scheduler() -> None:
    """Run a full NANP scan ~30 min after startup, then every 24 h.

    Also skips the initial scan if one completed within the last 20 hours
    (prevents double-scans on Railway restarts).
    """
    from app.routers.number_hunter import daily_scan
    from app.db import get_db
    from datetime import datetime, timezone, timedelta

    await asyncio.sleep(1800)   # 30-min warm-up on cold start

    while True:
        # Skip if a scan completed recently (within last 20 h)
        try:
            db = get_db()
            recent = (
                db.table("number_scan_runs")
                .select("completed_at")
                .eq("status", "completed")
                .order("completed_at", desc=True)
                .limit(1)
                .execute()
                .data
            )
            if recent and recent[0]["completed_at"]:
                last = datetime.fromisoformat(recent[0]["completed_at"].replace("Z", "+00:00"))
                if datetime.now(timezone.utc) - last < timedelta(hours=20):
                    await asyncio.sleep(3600)
                    continue
        except Exception:
            pass

        try:
            await daily_scan()
        except Exception as exc:
            logger.error("number_hunter daily_scan error", error=str(exc))
        await asyncio.sleep(86400)  # 24 hours


async def _schedule_checker() -> None:
    """Check every 30 min for due scan schedules and fire them."""
    from app.routers.number_hunter import scan_country, _scan_running, NANP_COUNTRIES
    from app.routers.admin import _compute_next_run
    from app.db import get_db
    from datetime import datetime, timezone

    await asyncio.sleep(60)   # 1-min warm-up after startup

    while True:
        try:
            db = get_db()
            now_iso = datetime.now(timezone.utc).isoformat()
            due = (
                db.table("number_scan_schedules")
                .select("*")
                .eq("is_active", True)
                .lte("next_run_at", now_iso)
                .execute()
                .data or []
            )
            for sched in due:
                if any(_scan_running.values()):
                    continue  # don't pile up scans

                countries = sched.get("countries") or list(NANP_COUNTRIES.keys())
                tiers = sched.get("tiers") or None
                sched_id = sched["id"]
                next_run = _compute_next_run(
                    sched["frequency"], sched.get("hour_of_day"),
                    sched.get("day_of_week"), sched.get("day_of_month"),
                )

                async def _run(countries=countries, tiers=tiers, sched_id=sched_id, next_run=next_run):
                    for c in countries:
                        if c not in NANP_COUNTRIES:
                            continue
                        _scan_running[c] = True
                        try:
                            await scan_country(c, NANP_COUNTRIES[c], tiers_filter=tiers)
                        finally:
                            _scan_running[c] = False
                    try:
                        db2 = get_db()
                        db2.table("number_scan_schedules").update({
                            "last_run_at": datetime.now(timezone.utc).isoformat(),
                            "next_run_at": next_run,
                        }).eq("id", sched_id).execute()
                    except Exception:
                        pass

                asyncio.create_task(_run())
        except Exception as exc:
            logger.error("schedule_checker error", error=str(exc))
        await asyncio.sleep(1800)  # check every 30 min


@app.get("/health")
def health():
    return {"ok": True, "service": "vani-api", "version": "2.0.0"}


@app.get("/debug/telnyx-test")
def debug_telnyx_test(pattern: str = "999999", country: str = "US"):
    """Test a single Telnyx search and return raw response."""
    import httpx
    from app.config import settings as s
    if not s.telnyx_api_key:
        return {"error": "TELNYX_API_KEY not set"}
    try:
        mode = "starts_with" if len(pattern) > 6 else "contains"
        params = {
            "filter[country_code]": country,
            "filter[limit]": 5,
        }
        if mode == "starts_with":
            params["filter[phone_number][starts_with]"] = f"+1{pattern}"
        else:
            params["filter[phone_number][contains]"] = pattern
        r = httpx.get(
            "https://api.telnyx.com/v2/available_phone_numbers",
            params=params,
            headers={"Authorization": f"Bearer {s.telnyx_api_key}"},
            timeout=15,
        )
        return {
            "status": r.status_code,
            "pattern": pattern,
            "results": len(r.json().get("data", [])),
            "numbers": [n.get("phone_number") for n in r.json().get("data", [])],
            "raw_keys": list(r.json().keys()),
        }
    except Exception as exc:
        return {"error": str(exc), "pattern": pattern}


@app.delete("/debug/hunter/clear")
def debug_clear():
    """Temporary — clear all results and scan logs."""
    from app.db import get_db as _gdb
    db = _gdb()
    db.table("number_hunt_results").delete().in_("status", ["available", "gone"]).execute()
    db.table("number_scan_runs").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    return {"cleared": True}


@app.get("/debug/hunter")
def debug_hunter():
    """Temporary debug endpoint — remove after scan is working."""
    from app.routers.number_hunter import _scan_running, _scan_progress, NANP_COUNTRIES, _search_errors
    from app.config import settings as s
    from app.db import get_db as _gdb
    db = _gdb()
    recent = db.table("number_scan_runs").select("*").order("started_at", desc=True).limit(5).execute().data or []
    avail = db.table("number_hunt_results").select("id", count="exact").eq("status", "available").execute()
    sample = db.table("number_hunt_results").select("number,country,tier,ai_score").eq("status", "available").order("first_seen", desc=True).limit(5).execute().data or []
    # Best numbers: seq6, seq7, A-tier
    best = db.table("number_hunt_results").select("number,tier,ai_score").eq("status", "available").in_("tier", ["P-seq6","P-seq7","A-seven","A-double-seq","A-mirror","A-double-rev"]).order("tier").limit(30).execute().data or []
    # Tier breakdown
    all_results = db.table("number_hunt_results").select("tier").eq("status", "available").execute().data or []
    tier_counts = {}
    for r in all_results:
        t = r.get("tier") or "unknown"
        tier_counts[t] = tier_counts.get(t, 0) + 1
    return {
        "in_memory": {
            "running": dict(_scan_running),
            "progress": dict(_scan_progress),
        },
        "db_scans": recent,
        "results_count": avail.count if avail else 0,
        "sample_results": sample,
        "best_numbers": best,
        "tier_breakdown": dict(sorted(tier_counts.items(), key=lambda x: -x[1])),
        "search_errors": dict(_search_errors),
        "twilio_configured": bool(s.twilio_account_sid and s.twilio_auth_token),
        "anthropic_configured": bool(s.anthropic_api_key),
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=True)
