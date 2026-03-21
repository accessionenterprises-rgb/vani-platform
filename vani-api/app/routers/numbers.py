"""Phone number management."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.db import get_db
from app.middleware.auth import get_tenant_id

router = APIRouter(prefix="/numbers", tags=["numbers"])


class AddNumberRequest(BaseModel):
    number: str
    agent_id: str
    provider: str = "twilio"
    sip_uri: str | None = None


class PhoneNumberResponse(BaseModel):
    id: str
    number: str
    agent_id: str
    provider: str
    sip_uri: str | None = None
    status: str
    created_at: str


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
    return [
        PhoneNumberResponse(
            id=str(r["id"]),
            number=r["number"],
            agent_id=str(r["agent_id"]),
            provider=r["provider"],
            sip_uri=r.get("sip_uri"),
            status=r["status"],
            created_at=str(r["created_at"]),
        )
        for r in result.data
    ]


@router.post("", response_model=PhoneNumberResponse, status_code=status.HTTP_201_CREATED)
async def add_number(body: AddNumberRequest, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    # Verify agent belongs to tenant
    agent = (
        db.table("agents")
        .select("id")
        .eq("id", body.agent_id)
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if agent.data is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Check number not already registered
    existing = (
        db.table("phone_numbers")
        .select("id")
        .eq("number", body.number)
        .maybe_single()
        .execute()
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
    row = result.data[0]
    return PhoneNumberResponse(
        id=str(row["id"]),
        number=row["number"],
        agent_id=str(row["agent_id"]),
        provider=row["provider"],
        sip_uri=row.get("sip_uri"),
        status=row["status"],
        created_at=str(row["created_at"]),
    )


@router.patch("/{number_id}", response_model=PhoneNumberResponse)
async def update_number(
    number_id: UUID,
    body: dict,
    tenant_id: str = Depends(get_tenant_id),
):
    db = get_db()
    existing = (
        db.table("phone_numbers")
        .select("*")
        .eq("id", str(number_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if existing.data is None:
        raise HTTPException(status_code=404, detail="Number not found")

    allowed = {"agent_id", "sip_uri", "status"}
    update = {k: v for k, v in body.items() if k in allowed}
    if not update:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    db.table("phone_numbers").update(update).eq("id", str(number_id)).execute()
    row = (
        db.table("phone_numbers")
        .select("*")
        .eq("id", str(number_id))
        .single()
        .execute()
    ).data
    return PhoneNumberResponse(
        id=str(row["id"]),
        number=row["number"],
        agent_id=str(row["agent_id"]),
        provider=row["provider"],
        sip_uri=row.get("sip_uri"),
        status=row["status"],
        created_at=str(row["created_at"]),
    )


@router.delete("/{number_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_number(number_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    existing = (
        db.table("phone_numbers")
        .select("id")
        .eq("id", str(number_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if existing.data is None:
        raise HTTPException(status_code=404, detail="Number not found")
    db.table("phone_numbers").delete().eq("id", str(number_id)).execute()
