"""Vani Orchestrator — entrypoint."""
import asyncio

import structlog
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routes import inbound, internal, transfer, kiosk
from routes import outbound_twiml
from telephony import exotel
from services.worker import connecting_watchdog, worker
from workers.post_processor import post_processor
from workers.outbound_caller import outbound_caller
from workers.campaign_worker import campaign_worker
from workers.sip_bridge import sip_bridge

logger = structlog.get_logger()

app = FastAPI(
    title="Vani Orchestrator",
    version="2.0.0",
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(inbound.router)
app.include_router(internal.router)
app.include_router(kiosk.router)
app.include_router(exotel.router)
app.include_router(outbound_twiml.router)
app.include_router(transfer.router)


@app.on_event("startup")
async def startup() -> None:
    logger.info("orchestrator_starting",
                workers=settings.worker_count,
                post_processors=settings.post_processor_count)

    for i in range(settings.worker_count):
        asyncio.create_task(worker(i))

    asyncio.create_task(connecting_watchdog())

    for i in range(settings.post_processor_count):
        asyncio.create_task(post_processor(i))

    outbound_count = settings.outbound_worker_count
    for i in range(outbound_count):
        asyncio.create_task(outbound_caller(i))

    asyncio.create_task(campaign_worker())
    asyncio.create_task(sip_bridge())

    logger.info("orchestrator_ready")


@app.get("/health")
def health():
    from workers.sip_bridge import _active_rooms
    return {
        "ok": True,
        "service": "vani-orchestrator",
        "version": "2.0.1",
        "workers": settings.worker_count,
        "sip_bridge": True,
        "sip_active_rooms": dict(_active_rooms),
    }


@app.get("/sip-bridge/test")
async def sip_bridge_test():
    """Test that the SIP bridge can list rooms."""
    from workers.sip_bridge import _list_rooms
    try:
        rooms = await _list_rooms()
        return {"ok": True, "rooms": rooms}
    except Exception as e:
        return {"ok": False, "error": str(e)}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=False)
