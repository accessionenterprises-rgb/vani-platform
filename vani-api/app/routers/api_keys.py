"""API keys management."""
import hashlib
import os
import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.db import get_db
from app.middleware.auth import get_tenant_id

router = APIRouter(prefix="/api-keys", tags=["api-keys"])

PREFIX = "vani_"


class CreateKeyRequest(BaseModel):
    name: str


class APIKeyResponse(BaseModel):
    id: str
    name: str
    created_at: str
    last_used: str | None = None


class APIKeyCreatedResponse(APIKeyResponse):
    key: str   # Only returned once at creation time


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


@router.get("", response_model=list[APIKeyResponse])
async def list_keys(tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    result = (
        db.table("api_keys")
        .select("id,name,created_at,last_used")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [
        APIKeyResponse(
            id=str(r["id"]),
            name=r["name"],
            created_at=str(r["created_at"]),
            last_used=str(r["last_used"]) if r.get("last_used") else None,
        )
        for r in result.data
    ]


@router.post("", response_model=APIKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_key(body: CreateKeyRequest, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    raw_key = PREFIX + secrets.token_urlsafe(32)
    result = (
        db.table("api_keys")
        .insert({
            "tenant_id": tenant_id,
            "name": body.name,
            "key_hash": _hash(raw_key),
        })
        .execute()
    )
    row = result.data[0]
    return APIKeyCreatedResponse(
        id=str(row["id"]),
        name=row["name"],
        created_at=str(row["created_at"]),
        key=raw_key,
    )


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_key(key_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    existing = (
        db.table("api_keys")
        .select("id")
        .eq("id", str(key_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if existing.data is None:
        raise HTTPException(status_code=404, detail="API key not found")
    db.table("api_keys").delete().eq("id", str(key_id)).execute()
