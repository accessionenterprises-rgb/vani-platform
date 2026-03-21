"""Agents CRUD endpoints — with versioning, extraction schema, custom LLM, escalation."""
import json
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.db import get_db
from app.middleware.auth import get_tenant_id

router = APIRouter(prefix="/agents", tags=["agents"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class BehaviorConfig(BaseModel):
    tone: str = "friendly"           # formal | friendly | sales
    objective: str = "support"       # support | book | qualify
    constraints: list[str] = []
    fallback: str = "Let me transfer you to our team."


class StackConfig(BaseModel):
    stt: str = "deepgram-nova-3"
    llm: str = "gpt-4o-mini"
    tts: str = "openai-nova"


class EscalationConfig(BaseModel):
    enabled: bool = False
    transfer_number: Optional[str] = None
    trigger: str = "user asks for human"
    whisper: str = "Caller is being transferred. Please assist them."


class CreateAgentRequest(BaseModel):
    name: str
    greeting: str = "Hello, how can I help you today?"
    prompt: str
    language: str = "en"
    voice: str = "openai-nova"
    behavior: BehaviorConfig = BehaviorConfig()
    stack: StackConfig = StackConfig()
    extraction_schema: list[dict] = []
    success_criteria: Optional[str] = None
    custom_llm_url: Optional[str] = None
    custom_llm_model: Optional[str] = None
    escalation_config: EscalationConfig = EscalationConfig()


class UpdateAgentRequest(BaseModel):
    name: Optional[str] = None
    greeting: Optional[str] = None
    prompt: Optional[str] = None
    language: Optional[str] = None
    voice: Optional[str] = None
    behavior: Optional[BehaviorConfig] = None
    stack: Optional[StackConfig] = None
    active: Optional[bool] = None
    extraction_schema: Optional[list[dict]] = None
    success_criteria: Optional[str] = None
    custom_llm_url: Optional[str] = None
    custom_llm_model: Optional[str] = None
    escalation_config: Optional[EscalationConfig] = None
    version_note: Optional[str] = None   # optional note saved with the version snapshot


class AgentResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    greeting: str
    prompt: str
    language: str
    voice: str
    stt_provider: str
    llm_provider: str
    tts_provider: str
    behavior: dict
    active: bool
    extraction_schema: list
    success_criteria: Optional[str]
    custom_llm_url: Optional[str]
    custom_llm_model: Optional[str]
    escalation_config: dict
    created_at: str


class AgentVersionResponse(BaseModel):
    id: str
    agent_id: str
    version_num: int
    note: Optional[str]
    created_at: str
    snapshot: dict


def _row_to_agent(row: dict) -> AgentResponse:
    return AgentResponse(
        id=str(row["id"]),
        tenant_id=row["tenant_id"],
        name=row["name"],
        greeting=row["greeting"],
        prompt=row["prompt"],
        language=row["language"],
        voice=row["voice"],
        stt_provider=row["stt_provider"],
        llm_provider=row["llm_provider"],
        tts_provider=row["tts_provider"],
        behavior=row["behavior"] or {},
        active=row["active"],
        extraction_schema=row.get("extraction_schema") or [],
        success_criteria=row.get("success_criteria"),
        custom_llm_url=row.get("custom_llm_url"),
        custom_llm_model=row.get("custom_llm_model"),
        escalation_config=row.get("escalation_config") or {},
        created_at=str(row["created_at"]),
    )


def _snapshot_agent(db, agent_id: str, tenant_id: str, note: Optional[str] = None) -> None:
    """Save current agent state as a version snapshot before any update."""
    try:
        current = (
            db.table("agents")
            .select("*")
            .eq("id", agent_id)
            .maybe_single()
            .execute()
        )
        if not current.data:
            return
        # Get next version number
        versions = (
            db.table("agent_versions")
            .select("version_num")
            .eq("agent_id", agent_id)
            .order("version_num", desc=True)
            .limit(1)
            .execute()
        )
        next_ver = ((versions.data[0]["version_num"] if versions.data else 0) + 1)
        # Serialize snapshot
        snapshot = {k: (str(v) if not isinstance(v, (str, int, float, bool, list, dict, type(None))) else v)
                    for k, v in current.data.items()}
        db.table("agent_versions").insert({
            "agent_id": agent_id,
            "tenant_id": tenant_id,
            "version_num": next_ver,
            "snapshot": snapshot,
            "note": note,
        }).execute()
    except Exception:
        pass  # versioning is best-effort — never block the main update


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("", response_model=list[AgentResponse])
async def list_agents(tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    result = (
        db.table("agents")
        .select("*")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [_row_to_agent(r) for r in result.data]


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(body: CreateAgentRequest, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    result = (
        db.table("agents")
        .insert({
            "tenant_id": tenant_id,
            "name": body.name,
            "greeting": body.greeting,
            "prompt": body.prompt,
            "language": body.language,
            "voice": body.voice,
            "stt_provider": body.stack.stt,
            "llm_provider": body.stack.llm,
            "tts_provider": body.stack.tts,
            "behavior": body.behavior.model_dump(),
            "extraction_schema": body.extraction_schema,
            "success_criteria": body.success_criteria,
            "custom_llm_url": body.custom_llm_url,
            "custom_llm_model": body.custom_llm_model,
            "escalation_config": body.escalation_config.model_dump(),
            "active": True,
        })
        .execute()
    )
    return _row_to_agent(result.data[0])


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    result = (
        db.table("agents")
        .select("*")
        .eq("id", str(agent_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if result.data is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return _row_to_agent(result.data)


@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_agent(agent_id: UUID, body: UpdateAgentRequest, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()

    # Verify ownership
    existing = (
        db.table("agents")
        .select("id")
        .eq("id", str(agent_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if existing.data is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Snapshot before update (best-effort)
    _snapshot_agent(db, str(agent_id), tenant_id, note=body.version_note)

    updates: dict = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.greeting is not None:
        updates["greeting"] = body.greeting
    if body.prompt is not None:
        updates["prompt"] = body.prompt
    if body.language is not None:
        updates["language"] = body.language
    if body.voice is not None:
        updates["voice"] = body.voice
    if body.active is not None:
        updates["active"] = body.active
    if body.behavior is not None:
        updates["behavior"] = body.behavior.model_dump()
    if body.stack is not None:
        updates["stt_provider"] = body.stack.stt
        updates["llm_provider"] = body.stack.llm
        updates["tts_provider"] = body.stack.tts
    if body.extraction_schema is not None:
        updates["extraction_schema"] = body.extraction_schema
    if body.success_criteria is not None:
        updates["success_criteria"] = body.success_criteria
    if body.custom_llm_url is not None:
        updates["custom_llm_url"] = body.custom_llm_url
    if body.custom_llm_model is not None:
        updates["custom_llm_model"] = body.custom_llm_model
    if body.escalation_config is not None:
        updates["escalation_config"] = body.escalation_config.model_dump()

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    db.table("agents").update(updates).eq("id", str(agent_id)).execute()
    result = (
        db.table("agents")
        .select("*")
        .eq("id", str(agent_id))
        .single()
        .execute()
    )
    return _row_to_agent(result.data)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(agent_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    existing = (
        db.table("agents")
        .select("id")
        .eq("id", str(agent_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if existing.data is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    db.table("agents").delete().eq("id", str(agent_id)).execute()


# ─── Version endpoints ────────────────────────────────────────────────────────

@router.get("/{agent_id}/versions", response_model=list[AgentVersionResponse])
async def list_versions(agent_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    # Verify ownership
    check = (
        db.table("agents")
        .select("id")
        .eq("id", str(agent_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if check.data is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    result = (
        db.table("agent_versions")
        .select("id, agent_id, version_num, note, created_at, snapshot")
        .eq("agent_id", str(agent_id))
        .order("version_num", desc=True)
        .limit(50)
        .execute()
    )
    return [
        AgentVersionResponse(
            id=str(r["id"]),
            agent_id=str(r["agent_id"]),
            version_num=r["version_num"],
            note=r.get("note"),
            created_at=str(r["created_at"]),
            snapshot=r["snapshot"],
        )
        for r in result.data
    ]


@router.post("/{agent_id}/versions/{version_id}/restore", response_model=AgentResponse)
async def restore_version(agent_id: UUID, version_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    # Verify ownership
    check = (
        db.table("agents")
        .select("id")
        .eq("id", str(agent_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if check.data is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    ver = (
        db.table("agent_versions")
        .select("snapshot")
        .eq("id", str(version_id))
        .eq("agent_id", str(agent_id))
        .maybe_single()
        .execute()
    )
    if ver.data is None:
        raise HTTPException(status_code=404, detail="Version not found")

    snap = ver.data["snapshot"]

    # Snapshot current state before restoring
    _snapshot_agent(db, str(agent_id), tenant_id, note=f"Auto-save before restore to version {version_id}")

    # Only restore mutable fields
    restorable = {
        k: snap[k] for k in (
            "name", "greeting", "prompt", "language", "voice",
            "stt_provider", "llm_provider", "tts_provider", "behavior",
            "extraction_schema", "success_criteria",
            "custom_llm_url", "custom_llm_model", "escalation_config",
        ) if k in snap
    }
    db.table("agents").update(restorable).eq("id", str(agent_id)).execute()

    result = (
        db.table("agents")
        .select("*")
        .eq("id", str(agent_id))
        .single()
        .execute()
    )
    return _row_to_agent(result.data)
