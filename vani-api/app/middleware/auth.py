"""JWT + API Key authentication middleware.

Validates tokens via direct REST call to Supabase /auth/v1/user —
works with ECC P-256 and legacy HS256 without any local JWT parsing.
"""
import hashlib
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.db import get_db

bearer = HTTPBearer(auto_error=False)

_AUTH_USER_URL = f"{settings.supabase_url}/auth/v1/user"
_BASE_HEADERS = {"apikey": settings.supabase_service_key}


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

    # ── JWT path — call Supabase /auth/v1/user with the token ─────────────────
    async with httpx.AsyncClient() as client:
        r = await client.get(
            _AUTH_USER_URL,
            headers={**_BASE_HEADERS, "Authorization": f"Bearer {token}"},
        )

    if r.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = r.json().get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # ── Check tenant is not disabled by admin ─────────────────────────────────
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

    return user_id
