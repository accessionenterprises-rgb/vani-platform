"""Team management endpoints — invite members, list, update roles, remove."""
import secrets
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from app.db import get_db
from app.middleware.auth import get_tenant_id

router = APIRouter(prefix="/team", tags=["Team"])

ROLES = ("admin", "member", "viewer")


class TeamMemberResponse(BaseModel):
    model_config = {"extra": "ignore"}
    id: str
    tenant_id: str
    email: str
    name: str
    role: str
    status: str
    invited_at: str
    joined_at: Optional[str] = None


class InviteRequest(BaseModel):
    email: str
    name: str
    role: str = "member"


class UpdateRoleRequest(BaseModel):
    role: str


def _ensure_table(db):
    """Check if team_members table exists — returns True if safe to query."""
    try:
        db.table("team_members").select("id").limit(1).execute()
        return True
    except Exception:
        return False


@router.get("", response_model=list[TeamMemberResponse])
async def list_team(tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    if not _ensure_table(db):
        return []
    result = (
        db.table("team_members")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("invited_at", desc=False)
        .execute()
    )
    return [TeamMemberResponse(**r) for r in result.data]


@router.post("", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
async def invite_member(body: InviteRequest, tenant_id: str = Depends(get_tenant_id)):
    if body.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(ROLES)}")

    db = get_db()
    if not _ensure_table(db):
        raise HTTPException(status_code=503, detail="Team management not yet available — run migration 017_team_members.sql")

    # Check for duplicate
    existing = (
        db.table("team_members")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("email", body.email)
        .maybe_single()
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="This email is already a team member")

    result = (
        db.table("team_members")
        .insert({
            "tenant_id": tenant_id,
            "email": body.email,
            "name": body.name,
            "role": body.role,
            "status": "invited",
            "invite_token": secrets.token_urlsafe(32),
            "invited_at": datetime.now(timezone.utc).isoformat(),
        })
        .execute()
    )
    return TeamMemberResponse(**result.data[0])


@router.patch("/{member_id}", response_model=TeamMemberResponse)
async def update_member(member_id: UUID, body: UpdateRoleRequest, tenant_id: str = Depends(get_tenant_id)):
    if body.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(ROLES)}")

    db = get_db()
    existing = (
        db.table("team_members")
        .select("*")
        .eq("id", str(member_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if existing.data is None:
        raise HTTPException(status_code=404, detail="Team member not found")

    result = (
        db.table("team_members")
        .update({"role": body.role})
        .eq("id", str(member_id))
        .execute()
    )
    return TeamMemberResponse(**result.data[0])


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(member_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    existing = (
        db.table("team_members")
        .select("id")
        .eq("id", str(member_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if existing.data is None:
        raise HTTPException(status_code=404, detail="Team member not found")

    db.table("team_members").delete().eq("id", str(member_id)).execute()
