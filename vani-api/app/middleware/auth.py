"""JWT + API Key authentication middleware.

Validates tokens via direct REST call to Supabase /auth/v1/user.
Uses a persistent HTTP client (connection pooling) and a 60-second
in-memory cache to avoid a fresh TCP/TLS handshake on every request.
"""
import hashlib
import time
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.db import get_db

bearer = HTTPBearer(auto_error=False)

_AUTH_USER_URL = f"{settings.supabase_url}/auth/v1/user"
_BASE_HEADERS = {"apikey": settings.supabase_service_key}

# Persistent client — reused across all requests (eliminates ~2.5s TCP/TLS setup per call)
_http_client: httpx.AsyncClient | None = None

# In-memory JWT cache: token -> (user_id, expiry_monotonic)
# After the first validation, subsequent calls within 60s are instant
_jwt_cache: dict[str, tuple[str, float]] = {}
_JWT_TTL = 60.0  # seconds


def _get_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=httpx.Timeout(10.0))
    return _http_client


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def get_tenant_id(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> str:
    """
    Accepts either:
      - Supabase JWT  (Authorization: Bearer <jwt>)
      - Vani API key (Authorization: Bearer vani_<key>)

    Returns tenant_id (auth user UUID string).
    """
    if creds is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")

    token = creds.credentials

    # ── API key path ──────────────────────────────────────────────────────────
    if token.startswith("vani_"):
        key_hash = _hash_key(token)
        db = get_db()
        row = (
            db.table("api_keys")
            .select("tenant_id")
            .eq("key_hash", key_hash)
            .maybe_single()
            .execute()
        )
        if row.data is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
        try:
            db.table("api_keys").update({"last_used": "now()"}).eq("key_hash", key_hash).execute()
        except Exception:
            pass
        return row.data["tenant_id"]

    # ── JWT path — check cache first ─────────────────────────────────────────
    now = time.monotonic()
    cached = _jwt_cache.get(token)
    if cached:
        user_id, expiry = cached
        if now < expiry:
            return user_id
        del _jwt_cache[token]

    # ── JWT path — call Supabase via persistent client ────────────────────────
    client = _get_client()
    r = await client.get(
        _AUTH_USER_URL,
        headers={**_BASE_HEADERS, "Authorization": f"Bearer {token}"},
    )

    if r.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = r.json().get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # ── Tenant active check ───────────────────────────────────────────────────
    db = get_db()
    tenant = (
        db.table("tenants")
        .select("active")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if tenant.data and tenant.data.get("active") is False:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    # Cache validated result
    _jwt_cache[token] = (user_id, now + _JWT_TTL)

    return user_id
