"""Webhook configuration — tenant sets a single delivery URL + secret."""
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.db import get_db
from app.middleware.auth import get_tenant_id

router = APIRouter(prefix="/webhook-config", tags=["webhook-config"])

ALL_EVENTS = [
    "call.started",
    "call.completed",
    "call.failed",
    "transcript.ready",
]


class WebhookConfigRequest(BaseModel):
    url: str
    secret: str | None = None          # auto-generated if omitted
    events: list[str] = ALL_EVENTS     # default: subscribe to everything
    active: bool = True


class WebhookConfigResponse(BaseModel):
    model_config = {"extra": "ignore"}
    id: str
    tenant_id: str
    url: str
    secret: str | None = None          # only returned on creation
    events: list[str]
    active: bool
    created_at: str
    updated_at: str | None = None


# ── POST — create or update webhook config ────────────────────────────────────
@router.post("", response_model=WebhookConfigResponse, status_code=status.HTTP_201_CREATED)
async def set_webhook_config(
    body: WebhookConfigRequest,
    tenant_id: str = Depends(get_tenant_id),
):
    unknown = [e for e in body.events if e not in ALL_EVENTS]
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown events: {unknown}. Valid: {ALL_EVENTS}",
        )

    db = get_db()
    secret = body.secret or secrets.token_hex(32)

    # Upsert — one config per tenant
    existing = (
        db.table("webhook_configs")
        .select("id")
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )

    if existing.data:
        # Update existing row
        db.table("webhook_configs").update({
            "url": body.url,
            "secret": secret,
            "events": body.events,
            "active": body.active,
        }).eq("id", existing.data["id"]).execute()
        row = (
            db.table("webhook_configs")
            .select("*")
            .eq("id", existing.data["id"])
            .single()
            .execute()
            .data
        )
    else:
        # Insert new row
        result = (
            db.table("webhook_configs")
            .insert({
                "tenant_id": tenant_id,
                "url": body.url,
                "secret": secret,
                "events": body.events,
                "active": body.active,
            })
            .execute()
        )
        row = result.data[0]

    return WebhookConfigResponse(
        id=str(row["id"]),
        tenant_id=row["tenant_id"],
        url=row["url"],
        secret=secret,  # shown once
        events=row["events"] or [],
        active=row["active"],
        created_at=str(row["created_at"]),
        updated_at=str(row.get("updated_at") or ""),
    )


# ── GET — retrieve current config ─────────────────────────────────────────────
@router.get("", response_model=WebhookConfigResponse | None)
async def get_webhook_config(tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    result = (
        db.table("webhook_configs")
        .select("*")
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if result.data is None:
        return None

    row = result.data
    return WebhookConfigResponse(
        id=str(row["id"]),
        tenant_id=row["tenant_id"],
        url=row["url"],
        # secret intentionally omitted on GET
        events=row["events"] or [],
        active=row["active"],
        created_at=str(row["created_at"]),
        updated_at=str(row.get("updated_at") or ""),
    )


# ── DELETE — remove webhook config ─────────────────────────────────────────────
@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook_config(tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    existing = (
        db.table("webhook_configs")
        .select("id")
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if existing.data is None:
        raise HTTPException(status_code=404, detail="No webhook config found")
    db.table("webhook_configs").delete().eq("id", existing.data["id"]).execute()
