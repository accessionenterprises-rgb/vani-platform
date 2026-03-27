"""Webhook endpoint management."""
import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.db import get_db
from app.middleware.auth import get_tenant_id

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

ALL_EVENTS = ["call.started", "call.ended", "call.analyzed"]


class CreateWebhookRequest(BaseModel):
    url: str
    events: list[str]
    secret: str | None = None   # auto-generated if not provided


class WebhookResponse(BaseModel):
    model_config = {"extra": "ignore"}
    id: str
    url: str
    events: list[str]
    secret: str | None = None   # only returned at creation time
    active: bool
    created_at: str


@router.get("", response_model=list[WebhookResponse])
async def list_webhooks(tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    result = (
        db.table("webhooks")
        .select("id,url,events,active,created_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [
        WebhookResponse(
            id=str(r["id"]),
            url=r["url"],
            events=r["events"] or [],
            active=r["active"],
            created_at=str(r["created_at"]),
        )
        for r in result.data
    ]


@router.post("", response_model=WebhookResponse, status_code=status.HTTP_201_CREATED)
async def create_webhook(body: CreateWebhookRequest, tenant_id: str = Depends(get_tenant_id)):
    unknown = [e for e in body.events if e not in ALL_EVENTS]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown events: {unknown}. Valid: {ALL_EVENTS}")

    db = get_db()
    secret = body.secret or secrets.token_hex(32)
    result = (
        db.table("webhooks")
        .insert({
            "tenant_id": tenant_id,
            "url": body.url,
            "events": body.events,
            "secret": secret,
            "active": True,
        })
        .execute()
    )
    row = result.data[0]
    return WebhookResponse(
        id=str(row["id"]),
        url=row["url"],
        events=row["events"] or [],
        secret=secret,   # shown once
        active=row["active"],
        created_at=str(row["created_at"]),
    )


@router.patch("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: UUID,
    body: dict,
    tenant_id: str = Depends(get_tenant_id),
):
    db = get_db()
    existing = (
        db.table("webhooks")
        .select("id")
        .eq("id", str(webhook_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if existing.data is None:
        raise HTTPException(status_code=404, detail="Webhook not found")

    allowed = {"url", "events", "active"}
    update = {k: v for k, v in body.items() if k in allowed}
    if not update:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    db.table("webhooks").update(update).eq("id", str(webhook_id)).execute()
    row = db.table("webhooks").select("*").eq("id", str(webhook_id)).single().execute().data
    return WebhookResponse(
        id=str(row["id"]),
        url=row["url"],
        events=row["events"] or [],
        active=row["active"],
        created_at=str(row["created_at"]),
    )


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(webhook_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    existing = (
        db.table("webhooks")
        .select("id")
        .eq("id", str(webhook_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if existing.data is None:
        raise HTTPException(status_code=404, detail="Webhook not found")
    db.table("webhooks").delete().eq("id", str(webhook_id)).execute()
