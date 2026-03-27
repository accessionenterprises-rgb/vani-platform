"""Phone number management — with Twilio search, buy, and sync."""
import os
from typing import Optional
from uuid import UUID

import anyio
import structlog

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.config import settings
from app.db import get_db
from app.middleware.auth import get_tenant_id

logger = structlog.get_logger()

ORCHESTRATOR_URL = os.getenv("ORCHESTRATOR_PUBLIC_URL", "https://orchestrator.vani.live")
INBOUND_WEBHOOK = f"{ORCHESTRATOR_URL}/telephony/inbound"
STATUS_WEBHOOK = f"{ORCHESTRATOR_URL}/telephony/status"

router = APIRouter(prefix="/numbers", tags=["Phone Numbers"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class AddNumberRequest(BaseModel):
    number: str
    agent_id: str
    provider: str = "twilio"
    sip_uri: Optional[str] = None


class BuyTwilioNumberRequest(BaseModel):
    phone_number: str
    agent_id: Optional[str] = None


class PhoneNumberResponse(BaseModel):
    model_config = {"extra": "ignore"}
    id: str
    number: str
    agent_id: Optional[str] = None
    provider: str
    sip_uri: Optional[str] = None
    status: str
    created_at: str


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _twilio_client():
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        raise HTTPException(
            status_code=400,
            detail="Twilio credentials not configured. Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
        )
    from twilio.rest import Client
    return Client(settings.twilio_account_sid, settings.twilio_auth_token)


def _configure_webhook(client, phone_sid: str):
    """Set inbound voice webhook on a Twilio number so calls route to the orchestrator."""
    try:
        client.incoming_phone_numbers(phone_sid).update(
            voice_url=INBOUND_WEBHOOK,
            voice_method="POST",
            status_callback=STATUS_WEBHOOK,
            status_callback_method="POST",
        )
        logger.info("twilio_webhook_configured", sid=phone_sid, url=INBOUND_WEBHOOK)
    except Exception as exc:
        logger.error("twilio_webhook_failed", sid=phone_sid, error=str(exc))


def _row(r: dict) -> PhoneNumberResponse:
    return PhoneNumberResponse(
        id=str(r["id"]),
        number=r["number"],
        agent_id=str(r["agent_id"]) if r.get("agent_id") else None,
        provider=r["provider"],
        sip_uri=r.get("sip_uri"),
        status=r["status"],
        created_at=str(r["created_at"]),
    )


# ─── Existing CRUD ────────────────────────────────────────────────────────────

@router.get("", response_model=list[PhoneNumberResponse])
async def list_numbers(tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    result = (
        db.table("phone_numbers")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [_row(r) for r in result.data]


@router.post("", response_model=PhoneNumberResponse, status_code=status.HTTP_201_CREATED)
async def add_number(body: AddNumberRequest, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    agent = (
        db.table("agents").select("id")
        .eq("id", body.agent_id).eq("tenant_id", tenant_id)
        .maybe_single().execute()
    )
    if agent.data is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    existing = (
        db.table("phone_numbers").select("id")
        .eq("number", body.number).maybe_single().execute()
    )
    if existing.data is not None:
        raise HTTPException(status_code=409, detail="Number already registered")

    result = (
        db.table("phone_numbers")
        .insert({
            "tenant_id": tenant_id,
            "agent_id": body.agent_id,
            "number": body.number,
            "provider": body.provider,
            "sip_uri": body.sip_uri,
            "status": "active",
        })
        .execute()
    )
    return _row(result.data[0])


@router.patch("/{number_id}", response_model=PhoneNumberResponse)
async def update_number(
    number_id: UUID,
    body: dict,
    tenant_id: str = Depends(get_tenant_id),
):
    db = get_db()
    existing = (
        db.table("phone_numbers").select("*")
        .eq("id", str(number_id)).eq("tenant_id", tenant_id)
        .maybe_single().execute()
    )
    if existing.data is None:
        raise HTTPException(status_code=404, detail="Number not found")

    allowed = {"agent_id", "sip_uri", "status"}
    update = {k: v for k, v in body.items() if k in allowed}
    if not update:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    db.table("phone_numbers").update(update).eq("id", str(number_id)).execute()
    row = (
        db.table("phone_numbers").select("*")
        .eq("id", str(number_id)).single().execute()
    ).data
    return _row(row)


@router.delete("/{number_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_number(number_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    existing = (
        db.table("phone_numbers").select("id")
        .eq("id", str(number_id)).eq("tenant_id", tenant_id)
        .maybe_single().execute()
    )
    if existing.data is None:
        raise HTTPException(status_code=404, detail="Number not found")
    db.table("phone_numbers").delete().eq("id", str(number_id)).execute()


# ─── Twilio: Search available numbers ─────────────────────────────────────────

@router.get("/available")
async def search_available_numbers(
    country: str = Query("US"),
    area_code: str = Query(None),
    number_type: str = Query("local"),   # local | toll_free | mobile
    contains: str = Query(None),
    limit: int = Query(20, le=50),
    tenant_id: str = Depends(get_tenant_id),
):
    try:
        client = _twilio_client()

        def _search():
            resource = getattr(
                client.available_phone_numbers(country),
                "toll_free" if number_type == "toll_free" else number_type,
            )
            kwargs: dict = {"limit": limit}
            if area_code and number_type == "local":
                kwargs["area_code"] = area_code
            if contains:
                kwargs["contains"] = contains
            return resource.list(**kwargs)

        numbers = await anyio.to_thread.run_sync(_search)
        return [
            {
                "phone_number": n.phone_number,
                "friendly_name": n.friendly_name,
                "locality": getattr(n, "locality", "") or "",
                "region": getattr(n, "region", "") or "",
                "country": country,
                "capabilities": {
                    "voice": bool((n.capabilities or {}).get("voice", False)),
                    "sms":   bool((n.capabilities or {}).get("sms",   False)),
                },
            }
            for n in numbers
        ]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Twilio search failed: {exc}")


# ─── Twilio: Buy a number ──────────────────────────────────────────────────────

@router.post("/buy", response_model=PhoneNumberResponse, status_code=status.HTTP_201_CREATED)
async def buy_twilio_number(
    body: BuyTwilioNumberRequest,
    tenant_id: str = Depends(get_tenant_id),
):
    db = get_db()

    if body.agent_id:
        agent = (
            db.table("agents").select("id")
            .eq("id", body.agent_id).eq("tenant_id", tenant_id)
            .maybe_single().execute()
        )
        if not agent.data:
            raise HTTPException(status_code=404, detail="Agent not found")

    existing = (
        db.table("phone_numbers").select("id")
        .eq("number", body.phone_number).maybe_single().execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="Number already registered")

    client = _twilio_client()
    try:
        purchased = await anyio.to_thread.run_sync(
            lambda: client.incoming_phone_numbers.create(phone_number=body.phone_number)
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Twilio purchase failed: {exc}")

    # Auto-configure webhook so inbound calls route to orchestrator
    await anyio.to_thread.run_sync(lambda: _configure_webhook(client, purchased.sid))

    result = (
        db.table("phone_numbers")
        .insert({
            "tenant_id": tenant_id,
            "agent_id": body.agent_id,
            "number": purchased.phone_number,
            "provider": "twilio",
            "twilio_sid": purchased.sid,
            "sip_uri": None,
            "status": "active",
        })
        .execute()
    )
    return _row(result.data[0])


# ─── Twilio: Sync existing numbers ────────────────────────────────────────────

@router.post("/sync")
async def sync_twilio_numbers(tenant_id: str = Depends(get_tenant_id)):
    db = get_db()

    existing = (
        db.table("phone_numbers").select("number")
        .eq("tenant_id", tenant_id).execute()
    )
    existing_set = {r["number"] for r in (existing.data or [])}

    client = _twilio_client()
    try:
        twilio_numbers = await anyio.to_thread.run_sync(client.incoming_phone_numbers.list)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Twilio sync failed: {exc}")

    imported = []
    skipped = 0
    for num in twilio_numbers:
        if num.phone_number in existing_set:
            # Still configure webhook on existing numbers in case it's missing
            await anyio.to_thread.run_sync(lambda sid=num.sid: _configure_webhook(client, sid))
            skipped += 1
            continue
        # Configure webhook on newly synced number
        await anyio.to_thread.run_sync(lambda sid=num.sid: _configure_webhook(client, sid))
        result = (
            db.table("phone_numbers")
            .insert({
                "tenant_id": tenant_id,
                "agent_id": None,
                "number": num.phone_number,
                "provider": "twilio",
                "twilio_sid": num.sid,
                "sip_uri": None,
                "status": "active",
            })
            .execute()
        )
        if result.data:
            imported.append(_row(result.data[0]).model_dump())

    return {
        "synced": len(imported),
        "skipped": skipped,
        "numbers": imported,
    }
