"""
Agent Tools — real-time function calling during conversations.

Each tool is an HTTP endpoint the engine calls during a live call:
  LLM detects intent → calls tool URL → injects result back into LLM context.

GET    /agents/:id/tools
POST   /agents/:id/tools
PATCH  /agents/:id/tools/:tool_id
DELETE /agents/:id/tools/:tool_id
"""
from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.db import get_db
from app.middleware.auth import get_tenant_id

logger = structlog.get_logger()

router = APIRouter(prefix="/agents/{agent_id}/tools", tags=["tools"])


class CreateToolRequest(BaseModel):
    name: str                              # snake_case, shown to LLM as function name
    description: str                       # what the tool does — LLM decides when to call it
    method: str = "POST"                   # GET | POST | PUT | PATCH
    url: str                               # endpoint to call
    headers: dict = {}                     # static headers (e.g. Authorization)
    params_schema: dict = {}               # JSON Schema for parameters LLM should provide


class UpdateToolRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    method: Optional[str] = None
    url: Optional[str] = None
    headers: Optional[dict] = None
    params_schema: Optional[dict] = None
    active: Optional[bool] = None


class ToolResponse(BaseModel):
    id: str
    agent_id: str
    name: str
    description: str
    method: str
    url: str
    headers: dict
    params_schema: dict
    active: bool
    created_at: str


def _row_to_tool(row: dict) -> ToolResponse:
    return ToolResponse(
        id=str(row["id"]),
        agent_id=str(row["agent_id"]),
        name=row["name"],
        description=row["description"],
        method=row["method"],
        url=row["url"],
        headers=row.get("headers") or {},
        params_schema=row.get("params_schema") or {},
        active=row["active"],
        created_at=str(row["created_at"]),
    )


def _verify_agent(agent_id: UUID, tenant_id: str) -> None:
    db = get_db()
    row = (
        db.table("agents").select("id")
        .eq("id", str(agent_id)).eq("tenant_id", tenant_id)
        .maybe_single().execute()
    )
    if row.data is None:
        raise HTTPException(status_code=404, detail="Agent not found")


@router.get("", response_model=list[ToolResponse])
async def list_tools(agent_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    _verify_agent(agent_id, tenant_id)
    db = get_db()
    result = (
        db.table("agent_tools")
        .select("*")
        .eq("agent_id", str(agent_id))
        .order("created_at")
        .execute()
    )
    return [_row_to_tool(r) for r in result.data]


@router.post("", response_model=ToolResponse, status_code=status.HTTP_201_CREATED)
async def create_tool(agent_id: UUID, body: CreateToolRequest, tenant_id: str = Depends(get_tenant_id)):
    _verify_agent(agent_id, tenant_id)

    # Validate name is snake_case
    if not body.name.replace("_", "").isalnum():
        raise HTTPException(status_code=400, detail="Tool name must be alphanumeric + underscores only")

    db = get_db()

    # Check duplicate name within agent
    dup = (
        db.table("agent_tools").select("id")
        .eq("agent_id", str(agent_id)).eq("name", body.name)
        .maybe_single().execute()
    )
    if dup.data:
        raise HTTPException(status_code=409, detail=f"Tool '{body.name}' already exists for this agent")

    result = (
        db.table("agent_tools")
        .insert({
            "agent_id": str(agent_id),
            "tenant_id": tenant_id,
            "name": body.name,
            "description": body.description,
            "method": body.method.upper(),
            "url": body.url,
            "headers": body.headers,
            "params_schema": body.params_schema,
        })
        .execute()
    )
    return _row_to_tool(result.data[0])


@router.patch("/{tool_id}", response_model=ToolResponse)
async def update_tool(agent_id: UUID, tool_id: UUID, body: UpdateToolRequest, tenant_id: str = Depends(get_tenant_id)):
    _verify_agent(agent_id, tenant_id)
    db = get_db()

    existing = (
        db.table("agent_tools").select("id")
        .eq("id", str(tool_id)).eq("agent_id", str(agent_id))
        .maybe_single().execute()
    )
    if existing.data is None:
        raise HTTPException(status_code=404, detail="Tool not found")

    updates = {}
    for field in ("name", "description", "method", "url", "headers", "params_schema", "active"):
        val = getattr(body, field)
        if val is not None:
            updates[field] = val.upper() if field == "method" else val

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    db.table("agent_tools").update(updates).eq("id", str(tool_id)).execute()
    result = db.table("agent_tools").select("*").eq("id", str(tool_id)).single().execute()
    return _row_to_tool(result.data)


@router.delete("/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tool(agent_id: UUID, tool_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    _verify_agent(agent_id, tenant_id)
    db = get_db()

    existing = (
        db.table("agent_tools").select("id")
        .eq("id", str(tool_id)).eq("agent_id", str(agent_id))
        .maybe_single().execute()
    )
    if existing.data is None:
        raise HTTPException(status_code=404, detail="Tool not found")

    db.table("agent_tools").delete().eq("id", str(tool_id)).execute()
