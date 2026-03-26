"""Redis-based rate limiting middleware.

Limits per API key / tenant:
  - Default: 60 req/min
  - /outbound, /calls/outbound: 10 req/min (expensive)
  - /tts-preview: 20 req/min
"""
import time
from typing import Optional

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = structlog.get_logger()

# In-memory fallback when Redis unavailable
_mem_store: dict[str, list[float]] = {}

# Rate limits: path prefix → (max_requests, window_seconds)
_STRICT_LIMITS = {
    "/outbound": (10, 60),
    "/calls/outbound": (10, 60),
    "/tts-preview": (20, 60),
    "/campaigns": (10, 60),
}
_DEFAULT_LIMIT = (60, 60)  # 60 req/min


def _get_limit(path: str) -> tuple[int, int]:
    for prefix, limit in _STRICT_LIMITS.items():
        if prefix in path:
            return limit
    return _DEFAULT_LIMIT


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, redis_url: Optional[str] = None):
        super().__init__(app)
        self._redis = None
        self._redis_url = redis_url

    async def _get_redis(self):
        if self._redis is None and self._redis_url:
            try:
                import redis.asyncio as aioredis
                self._redis = aioredis.from_url(self._redis_url, decode_responses=True)
            except Exception:
                pass
        return self._redis

    async def _check_redis(self, key: str, max_req: int, window: int) -> tuple[bool, int]:
        """Check rate limit via Redis. Returns (allowed, remaining)."""
        r = await self._get_redis()
        if not r:
            return self._check_memory(key, max_req, window)
        try:
            pipe = r.pipeline()
            now = time.time()
            pipe.zremrangebyscore(key, 0, now - window)
            pipe.zadd(key, {str(now): now})
            pipe.zcard(key)
            pipe.expire(key, window)
            results = await pipe.execute()
            count = results[2]
            allowed = count <= max_req
            remaining = max(0, max_req - count)
            return allowed, remaining
        except Exception:
            return self._check_memory(key, max_req, window)

    def _check_memory(self, key: str, max_req: int, window: int) -> tuple[bool, int]:
        """Fallback in-memory rate limiter."""
        now = time.time()
        if key not in _mem_store:
            _mem_store[key] = []
        _mem_store[key] = [t for t in _mem_store[key] if t > now - window]
        _mem_store[key].append(now)
        count = len(_mem_store[key])
        allowed = count <= max_req
        remaining = max(0, max_req - count)
        return allowed, remaining

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        # Skip non-API paths
        if path in ("/health", "/docs", "/redoc", "/openapi.json") or path.startswith("/static"):
            return await call_next(request)

        # Get tenant from auth (set by auth middleware via Depends)
        tenant_id = getattr(request.state, "tenant_id", None)
        if not tenant_id:
            # No auth = no rate limit (auth middleware will reject anyway)
            return await call_next(request)

        max_req, window = _get_limit(path)
        key = f"rl:{tenant_id}:{path.split('/')[1] if '/' in path[1:] else path}"

        allowed, remaining = await self._check_redis(key, max_req, window)

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "rate_limit_exceeded",
                    "message": f"Too many requests. Limit: {max_req} per {window}s.",
                    "retry_after": window,
                },
                headers={"Retry-After": str(window), "X-RateLimit-Remaining": "0"},
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(max_req)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
