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

API_DESCRIPTION = """\
# Vani Voice AI API

Build voice AI agents that answer calls, book appointments, qualify leads, and handle support — fully automated.

## Authentication
All endpoints require authentication via Bearer token:
```
Authorization: Bearer vani_YOUR_API_KEY
```

Get your API key from the [Dashboard](https://dashboard.vani.live) → API Keys.

## Rate Limits
- Default: 60 requests/minute
- Outbound calls: 10 requests/minute
- TTS preview: 20 requests/minute

Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`

## Base URL
```
https://api.vani.live/v1
```
"""

app = FastAPI(
    title="Vani API",
    description=API_DESCRIPTION,
    version="1.0.0",
    docs_url=None,       # custom /docs below
    redoc_url="/redoc",
)


# ── Custom Swagger UI (dark theme + Vani branding) ───────────────────────────
@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui():
    from fastapi.responses import HTMLResponse
    return HTMLResponse("""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vani API — Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: #0a0a0a; color: #e5e5e5; }

    /* Header */
    .api-header {
      background: #0a0a0a;
      border-bottom: 1px solid #1a1a1a;
      padding: 20px 32px;
      display: flex; align-items: center; justify-content: space-between;
      position: sticky; top: 0; z-index: 100;
    }
    .api-header .logo {
      display: flex; align-items: center; gap: 12px;
      font-size: 18px; font-weight: 700; color: #fff; text-decoration: none;
    }
    .api-header .logo .dot-grid {
      display: inline-grid; grid-template-columns: repeat(3,1fr); gap: 2px;
    }
    .api-header .logo .dot-grid i {
      width: 4px; height: 4px; background: #fff; border-radius: 1px; display: block;
    }
    .api-header .badge {
      font-size: 11px; font-weight: 600; background: #16a34a20; color: #22c55e;
      padding: 4px 10px; border-radius: 20px; letter-spacing: 0.03em;
    }
    .api-header nav { display: flex; gap: 8px; }
    .api-header nav a {
      font-size: 13px; font-weight: 500; color: #888; text-decoration: none;
      padding: 6px 14px; border-radius: 8px; transition: all 0.2s;
    }
    .api-header nav a:hover { color: #fff; background: #1a1a1a; }

    /* Hero section */
    .api-hero {
      max-width: 800px; margin: 0 auto; padding: 48px 32px 32px;
    }
    .api-hero h1 {
      font-size: 32px; font-weight: 700; color: #fff; letter-spacing: -0.02em; margin-bottom: 12px;
    }
    .api-hero p { font-size: 16px; color: #888; line-height: 1.6; max-width: 560px; }

    /* Quick start cards */
    .quick-cards {
      max-width: 800px; margin: 0 auto; padding: 0 32px 40px;
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
    }
    .qcard {
      background: #111; border: 1px solid #1a1a1a; border-radius: 12px;
      padding: 20px; transition: border-color 0.2s;
    }
    .qcard:hover { border-color: #333; }
    .qcard .label { font-size: 11px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
    .qcard .value { font-size: 14px; font-weight: 600; color: #e5e5e5; }
    .qcard .hint { font-size: 12px; color: #555; margin-top: 4px; }
    .qcard code {
      display: block; margin-top: 10px; font-size: 12px; color: #22c55e;
      background: #0a0a0a; padding: 8px 10px; border-radius: 6px; font-family: 'SF Mono', monospace;
      overflow-x: auto; white-space: nowrap;
    }

    /* Swagger container */
    .swagger-wrap {
      max-width: 900px; margin: 0 auto; padding: 0 32px 60px;
    }
    .swagger-wrap .section-label {
      font-size: 11px; font-weight: 600; color: #555; text-transform: uppercase;
      letter-spacing: 0.1em; margin-bottom: 16px; padding-top: 20px;
      border-top: 1px solid #1a1a1a;
    }

    /* Dark Swagger overrides */
    .swagger-ui { background: transparent !important; }
    .swagger-ui .topbar { display: none !important; }
    .swagger-ui .info { display: none !important; }
    .swagger-ui .scheme-container { display: none !important; }
    .swagger-ui .wrapper { padding: 0 !important; max-width: 100% !important; }
    .swagger-ui .opblock-tag { color: #e5e5e5 !important; border-bottom: 1px solid #1a1a1a !important; font-family: 'Inter', sans-serif !important; }
    .swagger-ui .opblock-tag:hover { background: #111 !important; }
    .swagger-ui .opblock { background: #111 !important; border: 1px solid #1a1a1a !important; border-radius: 8px !important; margin-bottom: 8px !important; }
    .swagger-ui .opblock .opblock-summary { border: none !important; }
    .swagger-ui .opblock .opblock-summary-method { border-radius: 6px !important; font-size: 12px !important; font-weight: 700 !important; min-width: 64px !important; }
    .swagger-ui .opblock .opblock-summary-path { color: #ccc !important; font-family: 'SF Mono', monospace !important; font-size: 13px !important; }
    .swagger-ui .opblock .opblock-summary-description { color: #888 !important; font-size: 13px !important; }
    .swagger-ui .opblock-body { background: #0d0d0d !important; }
    .swagger-ui .opblock-body pre { background: #0a0a0a !important; color: #22c55e !important; border: 1px solid #1a1a1a !important; border-radius: 6px !important; }
    .swagger-ui .btn { border-radius: 6px !important; }
    .swagger-ui .btn.execute { background: #2563eb !important; border: none !important; }
    .swagger-ui .btn.authorize { background: #111 !important; border: 1px solid #333 !important; color: #e5e5e5 !important; }
    .swagger-ui table tbody tr td { color: #ccc !important; border-bottom: 1px solid #1a1a1a !important; }
    .swagger-ui table thead tr th { color: #888 !important; border-bottom: 1px solid #1a1a1a !important; }
    .swagger-ui .model-box { background: #0a0a0a !important; }
    .swagger-ui .model { color: #ccc !important; }
    .swagger-ui input[type=text], .swagger-ui textarea, .swagger-ui select { background: #0a0a0a !important; color: #e5e5e5 !important; border: 1px solid #333 !important; border-radius: 6px !important; }
    .swagger-ui .response-col_status { color: #22c55e !important; }
    .swagger-ui .responses-inner { background: #0d0d0d !important; }
    .swagger-ui .filter .operation-filter-input { background: #111 !important; color: #e5e5e5 !important; border: 1px solid #1a1a1a !important; border-radius: 8px !important; font-family: 'Inter', sans-serif !important; }
    .swagger-ui .opblock-description-wrapper p { color: #888 !important; }
    .swagger-ui .parameter__name { color: #e5e5e5 !important; }
    .swagger-ui .parameter__type { color: #888 !important; }
    .swagger-ui .tab li { color: #888 !important; }
    .swagger-ui .tab li.active { color: #fff !important; }
    .swagger-ui .loading-container { background: transparent !important; }
    .swagger-ui .loading-container .loading:after { color: #888 !important; }
    .swagger-ui section.models { border: 1px solid #1a1a1a !important; border-radius: 8px !important; }
    .swagger-ui section.models h4 { color: #888 !important; border-bottom: 1px solid #1a1a1a !important; }

    @media (max-width: 768px) {
      .quick-cards { grid-template-columns: 1fr; }
      .api-header nav { display: none; }
    }
  </style>
</head>
<body>

<header class="api-header">
  <a href="https://vani.live" class="logo">
    <span class="dot-grid"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
    Vani
  </a>
  <span class="badge">API v1</span>
  <nav>
    <a href="https://dashboard.vani.live">Dashboard</a>
    <a href="https://vani.live">Website</a>
    <a href="mailto:hello@vani.live">Support</a>
  </nav>
</header>

<div class="api-hero">
  <h1>API Reference</h1>
  <p>Build voice AI agents that answer calls, qualify leads, and handle support. Authenticate with your API key, then start making calls.</p>
</div>

<div class="quick-cards">
  <div class="qcard">
    <div class="label">Base URL</div>
    <div class="value">api.vani.live/v1</div>
    <code>https://api.vani.live/v1</code>
  </div>
  <div class="qcard">
    <div class="label">Authentication</div>
    <div class="value">Bearer Token</div>
    <code>Authorization: Bearer vani_...</code>
  </div>
  <div class="qcard">
    <div class="label">Rate Limit</div>
    <div class="value">60 req/min</div>
    <div class="hint">10/min for outbound calls</div>
  </div>
</div>

<div class="swagger-wrap">
  <div class="section-label">Endpoints</div>
  <div id="swagger-ui"></div>
</div>

<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
  SwaggerUIBundle({
    url: '/openapi.json',
    dom_id: '#swagger-ui',
    layout: 'BaseLayout',
    deepLinking: true,
    docExpansion: 'none',
    filter: true,
    tryItOutEnabled: true,
    syntaxHighlight: { theme: 'monokai' },
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
  });
</script>

</body>
</html>""")


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
# Hidden from API docs (include_in_schema=False).
app.include_router(auth.router,             include_in_schema=False)
app.include_router(agents.router,           include_in_schema=False)
app.include_router(kb.router,               include_in_schema=False)
app.include_router(tools.router,            include_in_schema=False)
app.include_router(products.router,         include_in_schema=False)
app.include_router(calls.router,            include_in_schema=False)
app.include_router(outbound.router,         include_in_schema=False)
app.include_router(campaigns.router,        include_in_schema=False)
app.include_router(analytics.router,        include_in_schema=False)
app.include_router(api_keys.router,         include_in_schema=False)
app.include_router(numbers.router,          include_in_schema=False)
app.include_router(number_hunter.router,    include_in_schema=False)
app.include_router(webhooks.router,         include_in_schema=False)
app.include_router(webhook_config.router,   include_in_schema=False)
app.include_router(dnc.router,              include_in_schema=False)
app.include_router(dialer.router,           include_in_schema=False)
app.include_router(team.router,             include_in_schema=False)
app.include_router(agent_builder.router,    include_in_schema=False)
app.include_router(tts_preview.router,      include_in_schema=False)
app.include_router(playground_chat.router,  include_in_schema=False)
app.include_router(playground_voice.router, include_in_schema=False)
app.include_router(qa_tester.router,        include_in_schema=False)
app.include_router(qa_reports.router,       include_in_schema=False)
app.include_router(latency.router,          include_in_schema=False)
app.include_router(billing.router,          include_in_schema=False)

# ── Internal routes (no versioning) — hidden from docs ────────────────────────
app.include_router(admin.router,      include_in_schema=False)
app.include_router(widget.router,     include_in_schema=False)
app.include_router(telephony.router,  include_in_schema=False)

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


@app.get("/health", include_in_schema=False)
def health():
    return {"ok": True, "service": "vani-api", "version": "1.0.0"}


# ── Debug endpoints (hidden from docs) ───────────────────────────────────────
@app.get("/debug/telnyx-test", include_in_schema=False)
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


@app.delete("/debug/hunter/clear", include_in_schema=False)
def debug_clear():
    """Temporary — clear all results and scan logs."""
    from app.db import get_db as _gdb
    db = _gdb()
    db.table("number_hunt_results").delete().in_("status", ["available", "gone"]).execute()
    db.table("number_scan_runs").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    return {"cleared": True}


@app.get("/debug/hunter", include_in_schema=False)
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
