"""Usage metering middleware — logs every API request per tenant for billing."""
import time
import asyncio
from datetime import datetime, timezone

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.db import get_db

logger = structlog.get_logger()

# Buffer writes — flush every 10 requests or 5 seconds
_usage_buffer: list[dict] = []
_flush_lock = asyncio.Lock()
_FLUSH_SIZE = 10
_FLUSH_INTERVAL = 5.0


async def _flush_buffer():
    """Write buffered usage logs to Supabase."""
    async with _flush_lock:
        if not _usage_buffer:
            return
        batch = _usage_buffer.copy()
        _usage_buffer.clear()
    try:
        db = get_db()
        db.table("api_usage").insert(batch).execute()
    except Exception as e:
        logger.warning("usage_flush_failed", error=str(e), count=len(batch))


class UsageMeteringMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.monotonic()
        response = await call_next(request)
        duration_ms = int((time.monotonic() - start) * 1000)

        # Only log API requests (skip health, static, etc.)
        path = request.url.path
        if path in ("/health", "/docs", "/redoc", "/openapi.json") or path.startswith("/static"):
            return response

        # Get tenant from request state (set by auth middleware)
        tenant_id = getattr(request.state, "tenant_id", None)

        _usage_buffer.append({
            "tenant_id": tenant_id,
            "method": request.method,
            "path": path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        # Flush if buffer is full
        if len(_usage_buffer) >= _FLUSH_SIZE:
            asyncio.create_task(_flush_buffer())

        return response


async def periodic_flush():
    """Background task to flush usage buffer every 5 seconds."""
    while True:
        await asyncio.sleep(_FLUSH_INTERVAL)
        await _flush_buffer()
