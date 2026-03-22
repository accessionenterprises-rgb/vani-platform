"""Vani API — entrypoint."""
import asyncio
import structlog
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import admin, agents, analytics, api_keys, auth, calls, campaigns, dialer, dnc, kb, number_hunter, numbers, outbound, playground_chat, products, tools, webhooks

logger = structlog.get_logger()

app = FastAPI(
    title="Vani API",
    version="2.0.0",
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.environment == "development" else [
        "https://vani.live",
        "https://app.vani.live",
        "https://dashboard.vani.live",
        "https://admin.vani.live",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
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
app.include_router(dnc.router)
app.include_router(playground_chat.router)
app.include_router(dialer.router)


@app.on_event("startup")
async def start_number_hunter_scheduler() -> None:
    """Launch the daily number hunter scan as a background asyncio task."""
    asyncio.create_task(_hunter_scheduler())


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


@app.get("/health")
def health():
    return {"ok": True, "service": "vani-api", "version": "2.0.0"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=True)
