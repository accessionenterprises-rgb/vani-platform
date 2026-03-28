"""Vani Orchestrator — entrypoint. Clean rebuild."""
import asyncio

import structlog
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routes import inbound, internal, transfer, kiosk, livekit_twiml
from routes import outbound_twiml
from telephony import exotel
from workers.post_processor import post_processor
from workers.outbound_caller import outbound_caller
from workers.campaign_worker import campaign_worker

logger = structlog.get_logger()

app = FastAPI(
    title="Vani Orchestrator",
    version="3.0.0",
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
app.include_router(livekit_twiml.router)


@app.on_event("startup")
async def startup() -> None:
    logger.info("orchestrator_starting",
                post_processors=settings.post_processor_count)

    for i in range(settings.post_processor_count):
        asyncio.create_task(post_processor(i))

    outbound_count = settings.outbound_worker_count
    for i in range(outbound_count):
        asyncio.create_task(outbound_caller(i))

    asyncio.create_task(campaign_worker())

    logger.info("orchestrator_ready")


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "vani-orchestrator",
        "version": "3.0.0",
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=False)
