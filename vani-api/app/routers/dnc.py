"""
DNC (Do-Not-Call) list management.

GET    /dnc              list blocked numbers
POST   /dnc              add a number
DELETE /dnc/{phone}      remove a number
GET    /dnc/check        check if a number is blocked
POST   /dnc/import       bulk CSV import
"""
import csv
import io
from typing import Optional
from urllib.parse import unquote

import structlog
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel

from app.db import get_db
from app.middleware.auth import get_tenant_id

logger = structlog.get_logger()

router = APIRouter(prefix="/dnc", tags=["dnc"])


class AddDNCRequest(BaseModel):
    phone: str
    reason: Optional[str] = None


class DNCEntry(BaseModel):
    id: str
    phone: str
    reason: Optional[str]
    created_at: str


# ── Endpoints ────────────────────────────────────────────────

@router.get("", response_model=list[DNCEntry])
async def list_dnc(
    limit: int = Query(200, le=1000),
    tenant_id: str = Depends(get_tenant_id),
):
    db = get_db()
    result = (
        db.table("dnc_numbers")
        .select("id, phone, reason, created_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [
        DNCEntry(id=str(r["id"]), phone=r["phone"], reason=r.get("reason"), created_at=str(r["created_at"]))
        for r in result.data
    ]


@router.get("/check")
async def check_dnc(
    phone: str = Query(...),
    tenant_id: str = Depends(get_tenant_id),
):
    db = get_db()
    result = (
        db.table("dnc_numbers")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("phone", phone.strip())
        .maybe_single()
        .execute()
    )
    return {"phone": phone.strip(), "blocked": result.data is not None}


@router.post("", status_code=status.HTTP_201_CREATED)
async def add_dnc(body: AddDNCRequest, tenant_id: str = Depends(get_tenant_id)):
    phone = body.phone.strip()
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number required")
    db = get_db()
    try:
        db.table("dnc_numbers").insert({
            "tenant_id": tenant_id,
            "phone": phone,
            "reason": body.reason,
        }).execute()
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(status_code=409, detail="Number already on DNC list")
        raise HTTPException(status_code=500, detail=str(e))
    logger.info("dnc_number_added", phone=phone, tenant_id=tenant_id)
    return {"phone": phone, "status": "added"}


@router.delete("/{phone}", status_code=status.HTTP_200_OK)
async def remove_dnc(phone: str, tenant_id: str = Depends(get_tenant_id)):
    phone = unquote(phone).strip()
    db = get_db()
    db.table("dnc_numbers").delete().eq("tenant_id", tenant_id).eq("phone", phone).execute()
    logger.info("dnc_number_removed", phone=phone, tenant_id=tenant_id)
    return {"phone": phone, "status": "removed"}


@router.post("/import", status_code=status.HTTP_201_CREATED)
async def import_dnc(
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_tenant_id),
):
    """Bulk import DNC numbers from CSV. Required column: phone. Optional: reason."""
    raw = await file.read()
    try:
        reader = csv.DictReader(io.StringIO(raw.decode("utf-8")))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse CSV file")

    entries = []
    for row in reader:
        phone = (row.get("phone") or row.get("Phone") or row.get("number") or "").strip()
        reason = (row.get("reason") or row.get("Reason") or "").strip() or None
        if phone:
            entries.append({"tenant_id": tenant_id, "phone": phone, "reason": reason})

    if not entries:
        raise HTTPException(status_code=400, detail="No valid phone numbers found in file")

    entries = entries[:5000]
    db = get_db()
    db.table("dnc_numbers").upsert(entries, on_conflict="tenant_id,phone").execute()
    logger.info("dnc_bulk_import", count=len(entries), tenant_id=tenant_id)
    return {"imported": len(entries)}
