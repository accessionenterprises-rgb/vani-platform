"""
Campaigns — bulk outbound calling.

POST   /campaigns                  create campaign
GET    /campaigns                  list campaigns
GET    /campaigns/:id              get campaign + stats
POST   /campaigns/:id/contacts     bulk upload contacts (CSV or JSON)
GET    /campaigns/:id/contacts     list contacts + status
POST   /campaigns/:id/start        kick off dialing
POST   /campaigns/:id/pause        pause running campaign
POST   /campaigns/:id/cancel       cancel campaign
"""
import csv
import io
import json
from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel

from app.db import get_db
from app.middleware.auth import get_tenant_id

logger = structlog.get_logger()

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CreateCampaignRequest(BaseModel):
    name: str
    agent_id: str
    from_number: Optional[str] = None
    scheduled_at: Optional[str] = None        # ISO 8601
    max_attempts: Optional[int] = 3
    retry_delay_min: Optional[int] = 60       # minutes between retries
    call_window_start: Optional[str] = None   # "HH:MM" — start of dialing window
    call_window_end: Optional[str] = None     # "HH:MM" — end of dialing window
    timezone: Optional[str] = "Asia/Kolkata"


class CampaignResponse(BaseModel):
    model_config = {"extra": "ignore"}
    id: str
    tenant_id: str
    agent_id: str
    name: str
    status: str
    from_number: Optional[str]
    scheduled_at: Optional[str]
    total_contacts: int
    called: int
    answered: int
    max_attempts: int
    retry_delay_min: int
    call_window_start: Optional[str]
    call_window_end: Optional[str]
    timezone: str
    created_at: str


class ContactRow(BaseModel):
    id: str
    phone: str
    name: Optional[str]
    status: str
    attempts: int
    last_outcome: Optional[str]
    next_retry_at: Optional[str]
    attempted_at: Optional[str]
    call_id: Optional[str]


def _row_to_campaign(row: dict) -> CampaignResponse:
    return CampaignResponse(
        id=str(row["id"]),
        tenant_id=row["tenant_id"],
        agent_id=str(row["agent_id"]),
        name=row["name"],
        status=row["status"],
        from_number=row.get("from_number"),
        scheduled_at=str(row["scheduled_at"]) if row.get("scheduled_at") else None,
        total_contacts=row.get("total_contacts") or 0,
        called=row.get("called") or 0,
        answered=row.get("answered") or 0,
        max_attempts=row.get("max_attempts") or 3,
        retry_delay_min=row.get("retry_delay_min") or 60,
        call_window_start=str(row["call_window_start"]) if row.get("call_window_start") else None,
        call_window_end=str(row["call_window_end"]) if row.get("call_window_end") else None,
        timezone=row.get("timezone") or "Asia/Kolkata",
        created_at=str(row["created_at"]),
    )


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("", response_model=list[CampaignResponse])
async def list_campaigns(
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    tenant_id: str = Depends(get_tenant_id),
):
    db = get_db()
    q = (
        db.table("campaigns")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .limit(limit)
    )
    if status:
        q = q.eq("status", status)
    result = q.execute()
    return [_row_to_campaign(r) for r in result.data]


@router.post("", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(body: CreateCampaignRequest, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()

    agent = (
        db.table("agents")
        .select("id, active")
        .eq("id", body.agent_id)
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if agent.data is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    result = (
        db.table("campaigns")
        .insert({
            "tenant_id":         tenant_id,
            "agent_id":          body.agent_id,
            "name":              body.name,
            "from_number":       body.from_number,
            "scheduled_at":      body.scheduled_at,
            "status":            "draft",
            "max_attempts":      body.max_attempts or 3,
            "retry_delay_min":   body.retry_delay_min or 60,
            "call_window_start": body.call_window_start,
            "call_window_end":   body.call_window_end,
            "timezone":          body.timezone or "Asia/Kolkata",
        })
        .execute()
    )
    return _row_to_campaign(result.data[0])


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    result = (
        db.table("campaigns")
        .select("*")
        .eq("id", str(campaign_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if result.data is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return _row_to_campaign(result.data)


@router.post("/{campaign_id}/contacts", status_code=status.HTTP_201_CREATED)
async def upload_contacts(
    campaign_id: UUID,
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_tenant_id),
):
    """
    Upload contacts as CSV or JSON array.

    CSV columns: phone (required), name (optional), + any extra columns
    become available as {variable} placeholders in the agent prompt/greeting.
    JSON: array of {phone, name, ...} objects.
    """
    db = get_db()

    campaign = (
        db.table("campaigns")
        .select("id, status, total_contacts")
        .eq("id", str(campaign_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if campaign.data is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.data["status"] not in ("draft", "paused"):
        raise HTTPException(status_code=400, detail="Can only add contacts to draft or paused campaigns")

    raw = await file.read()
    filename = (file.filename or "").lower()
    contacts = []

    if filename.endswith(".csv"):
        reader = csv.DictReader(io.StringIO(raw.decode("utf-8")))
        non_metadata_cols = {"phone", "Phone", "name", "Name"}
        for row in reader:
            phone = (row.get("phone") or row.get("Phone") or "").strip()
            if not phone:
                continue
            # All extra columns become metadata for variable injection
            metadata = {k: v for k, v in row.items() if k not in non_metadata_cols and v}
            contacts.append({
                "campaign_id": str(campaign_id),
                "tenant_id":   tenant_id,
                "phone":       phone,
                "name":        (row.get("name") or row.get("Name") or "").strip() or None,
                "metadata":    metadata,
            })

    elif filename.endswith(".json"):
        data = json.loads(raw)
        if not isinstance(data, list):
            raise HTTPException(status_code=400, detail="JSON must be an array")
        for item in data:
            phone = (item.get("phone") or "").strip()
            if not phone:
                continue
            contacts.append({
                "campaign_id": str(campaign_id),
                "tenant_id":   tenant_id,
                "phone":       phone,
                "name":        item.get("name"),
                "metadata":    item.get("metadata", {}),
            })
    else:
        raise HTTPException(status_code=400, detail="Only CSV or JSON files supported")

    if not contacts:
        raise HTTPException(status_code=400, detail="No valid contacts found in file")

    contacts = contacts[:5000]
    db.table("campaign_contacts").insert(contacts).execute()

    existing = campaign.data.get("total_contacts") or 0
    db.table("campaigns").update({
        "total_contacts": existing + len(contacts)
    }).eq("id", str(campaign_id)).execute()

    return {"inserted": len(contacts), "total": existing + len(contacts)}


@router.get("/{campaign_id}/contacts", response_model=list[ContactRow])
async def list_contacts(
    campaign_id: UUID,
    status: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    tenant_id: str = Depends(get_tenant_id),
):
    db = get_db()
    q = (
        db.table("campaign_contacts")
        .select("id, phone, name, status, attempts, last_outcome, next_retry_at, attempted_at, call_id")
        .eq("campaign_id", str(campaign_id))
        .eq("tenant_id", tenant_id)
        .order("created_at")
        .range(offset, offset + limit - 1)
    )
    if status:
        q = q.eq("status", status)
    result = q.execute()
    return [
        ContactRow(
            id=str(r["id"]),
            phone=r["phone"],
            name=r.get("name"),
            status=r["status"],
            attempts=r.get("attempts") or 0,
            last_outcome=r.get("last_outcome"),
            next_retry_at=str(r["next_retry_at"]) if r.get("next_retry_at") else None,
            attempted_at=str(r["attempted_at"]) if r.get("attempted_at") else None,
            call_id=str(r["call_id"]) if r.get("call_id") else None,
        )
        for r in result.data
    ]


@router.post("/{campaign_id}/start", status_code=status.HTTP_200_OK)
async def start_campaign(campaign_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    campaign = (
        db.table("campaigns")
        .select("id, status, total_contacts")
        .eq("id", str(campaign_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if campaign.data is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.data["status"] not in ("draft", "paused", "scheduled"):
        raise HTTPException(status_code=400, detail=f"Cannot start a {campaign.data['status']} campaign")
    if not campaign.data.get("total_contacts"):
        raise HTTPException(status_code=400, detail="Upload contacts before starting")

    db.table("campaigns").update({"status": "running"}).eq("id", str(campaign_id)).execute()
    return {"campaign_id": str(campaign_id), "status": "running"}


@router.post("/{campaign_id}/pause", status_code=status.HTTP_200_OK)
async def pause_campaign(campaign_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    campaign = (
        db.table("campaigns")
        .select("id, status")
        .eq("id", str(campaign_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if campaign.data is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.data["status"] != "running":
        raise HTTPException(status_code=400, detail="Only running campaigns can be paused")

    db.table("campaigns").update({"status": "paused"}).eq("id", str(campaign_id)).execute()
    return {"campaign_id": str(campaign_id), "status": "paused"}


@router.post("/{campaign_id}/cancel", status_code=status.HTTP_200_OK)
async def cancel_campaign(campaign_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    campaign = (
        db.table("campaigns")
        .select("id, status")
        .eq("id", str(campaign_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if campaign.data is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.data["status"] in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Campaign already finished")

    db.table("campaigns").update({"status": "cancelled"}).eq("id", str(campaign_id)).execute()
    db.table("campaign_contacts").update({"status": "skipped"}).eq(
        "campaign_id", str(campaign_id)
    ).eq("status", "pending").execute()

    return {"campaign_id": str(campaign_id), "status": "cancelled"}
