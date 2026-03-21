"""Vani API — entrypoint."""
import structlog
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import agents, analytics, api_keys, auth, calls, campaigns, dnc, kb, numbers, outbound, playground_chat, products, tools, webhooks

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
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
app.include_router(webhooks.router)
app.include_router(dnc.router)
app.include_router(playground_chat.router)


@app.get("/health")
def health():
    return {"ok": True, "service": "vani-api", "version": "2.0.0"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=True)
