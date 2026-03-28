"""Agents CRUD endpoints — with versioning, extraction schema, custom LLM, escalation."""
import json
import secrets
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.db import get_db
from app.middleware.auth import get_tenant_id

router = APIRouter(prefix="/agents", tags=["Agents"])


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
    cool_off_sec: int = 0
    announce_transfer: bool = True


class TuningConfig(BaseModel):
    temperature: float = 0.7
    max_tokens: int = 200
    endpointing_ms: int = 300
    linear_delay_ms: int = 200
    interrupt_word_count: int = 2
    buffer_size: int = 200
    silence_timeout_sec: int = 10
    call_timeout_sec: int = 300
    voicemail_detection: bool = False
    dtmf_enabled: bool = False
    noise_cancellation: bool = False
    ambient_noise: str = "none"          # none | office | cafe | street
    final_message: str = ""
    summarization_enabled: bool = True
    extraction_enabled: bool = False
    extraction_categories: list[dict] = []   # [{name, description}]
    keywords_boost: list[str] = []           # STT keyword boosting
    spam_max_calls: int = -1                 # -1 = unlimited


class CreateAgentRequest(BaseModel):
    name: str
    greeting: str = "Hello, how can I help you today?"
    prompt: str
    language: str = "en"
    voice: str = "openai-nova"
    agent_type: str = "voice"  # "voice" | "chatbot"
    behavior: BehaviorConfig = BehaviorConfig()
    stack: StackConfig = StackConfig()
    extraction_schema: list[dict] = []
    success_criteria: Optional[str] = None
    custom_llm_url: Optional[str] = None
    custom_llm_model: Optional[str] = None
    escalation_config: EscalationConfig = EscalationConfig()
    widget_config: Optional[dict] = None
    tuning: TuningConfig = TuningConfig()


class UpdateAgentRequest(BaseModel):
    name: Optional[str] = None
    greeting: Optional[str] = None
    prompt: Optional[str] = None
    language: Optional[str] = None
    voice: Optional[str] = None
    agent_type: Optional[str] = None
    behavior: Optional[BehaviorConfig] = None
    stack: Optional[StackConfig] = None
    active: Optional[bool] = None
    extraction_schema: Optional[list[dict]] = None
    success_criteria: Optional[str] = None
    custom_llm_url: Optional[str] = None
    custom_llm_model: Optional[str] = None
    escalation_config: Optional[EscalationConfig] = None
    widget_config: Optional[dict] = None
    tuning: Optional[TuningConfig] = None
    version_note: Optional[str] = None   # optional note saved with the version snapshot


class AgentResponse(BaseModel):
    model_config = {"extra": "ignore"}
    id: str
    tenant_id: str
    name: str
    greeting: str
    prompt: str
    language: str
    voice: str
    agent_type: str
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
    widget_config: Optional[dict]
    tuning: dict
    created_at: str


class AgentVersionResponse(BaseModel):
    model_config = {"extra": "ignore"}
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
        agent_type=row.get("agent_type") or "voice",
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
        widget_config=row.get("widget_config"),
        tuning=row.get("tuning") or TuningConfig().model_dump(),
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
            "agent_type": body.agent_type,
            "stt_provider": body.stack.stt,
            "llm_provider": body.stack.llm,
            "tts_provider": body.stack.tts,
            "behavior": body.behavior.model_dump(),
            "extraction_schema": body.extraction_schema,
            "success_criteria": body.success_criteria,
            "custom_llm_url": body.custom_llm_url,
            "custom_llm_model": body.custom_llm_model,
            "escalation_config": body.escalation_config.model_dump(),
            "widget_config": body.widget_config or {},
            "tuning": body.tuning.model_dump(),
            "active": True,
        })
        .execute()
    )
    agent_row = result.data[0]

    # Auto-generate widget key for chatbot agents
    if body.agent_type == "chatbot":
        widget_key = f"wk_{secrets.token_urlsafe(24)}"
        try:
            db.table("widget_keys").insert({
                "tenant_id": tenant_id,
                "agent_id": str(agent_row["id"]),
                "widget_key": widget_key,
            }).execute()
        except Exception:
            pass  # best-effort — user can regenerate later

    return _row_to_agent(agent_row)


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

    # ── Auto-fix voice if it doesn't match TTS provider ──
    _TTS_DEFAULT_VOICES = {
        "openai": "nova",
        "sarvam": "manisha",
        "sarvam-v3": "shreya",
        "cartesia": "e07c00bc-4134-4eae-9ea4-1a55fb45746b",
        "elevenlabs": "EXAVITQu4vr4xnSDxMaL",
        "polly": "Danielle",
        "google": "en-US-Neural2-F",
        "azure": "en-US-JennyNeural",
        "gemini-live": "Puck",
    }
    _TTS_VALID_VOICES = {
        "openai": {"alloy", "ash", "ballad", "cedar", "coral", "echo", "fable", "marin", "nova", "onyx", "sage", "shimmer", "verse"},
        "sarvam": {"anushka", "abhilash", "manisha", "vidya", "arya", "karun", "hitesh"},
        "sarvam-v3": {"shreya", "amelia", "sophia", "priya", "neha", "kavya", "simran", "ritu", "pooja", "ishita", "roopa", "tanya", "shruti", "suhani", "rupali", "kavitha", "rahul", "amit", "dev", "rohan", "kabir", "aditya", "ashutosh", "ratan", "varun", "manan", "sumit", "aayan", "shubh", "advait", "anand", "tarun", "sunny", "mani", "gokul", "vijay", "mohit", "rehan", "soham"},
        "gemini-live": {"Zephyr", "Kore", "Orus", "Autonoe", "Umbriel", "Erinome", "Laomedeia", "Schedar", "Achird", "Sadachbia", "Puck", "Fenrir", "Aoede", "Enceladus", "Algieba", "Algenib", "Achernar", "Gacrux", "Zubenelgenubi", "Sadaltager", "Charon", "Leda", "Callirrhoe", "Iapetus", "Despina", "Rasalgethi", "Alnilam", "Pulcherrima", "Vindemiatrix", "Sulafat"},
    }
    tts = updates.get("tts_provider") or (body.stack.tts if body.stack else None)
    voice = updates.get("voice")
    if tts and voice:
        valid = _TTS_VALID_VOICES.get(tts)
        if valid and voice not in valid and not (len(voice) > 20 and "-" in voice):
            updates["voice"] = _TTS_DEFAULT_VOICES.get(tts, voice)
    elif tts and not voice:
        updates["voice"] = _TTS_DEFAULT_VOICES.get(tts, updates.get("voice", "nova"))
    if body.success_criteria is not None:
        updates["success_criteria"] = body.success_criteria
    if body.custom_llm_url is not None:
        updates["custom_llm_url"] = body.custom_llm_url
    if body.custom_llm_model is not None:
        updates["custom_llm_model"] = body.custom_llm_model
    if body.escalation_config is not None:
        updates["escalation_config"] = body.escalation_config.model_dump()
    if body.agent_type is not None:
        updates["agent_type"] = body.agent_type
    if body.widget_config is not None:
        updates["widget_config"] = body.widget_config
    if body.tuning is not None:
        updates["tuning"] = body.tuning.model_dump()

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


# ─── Widget key endpoints ────────────────────────────────────────────────────

@router.get("/{agent_id}/widget-key")
async def get_widget_key(agent_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    result = (
        db.table("widget_keys")
        .select("widget_key, allowed_origins, active, created_at")
        .eq("agent_id", str(agent_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        return {"widget_key": None}
    return result.data


@router.post("/{agent_id}/widget-key")
async def create_or_regenerate_widget_key(agent_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    # Verify agent ownership
    agent = (
        db.table("agents").select("id")
        .eq("id", str(agent_id)).eq("tenant_id", tenant_id)
        .maybe_single().execute()
    )
    if not agent.data:
        raise HTTPException(status_code=404, detail="Agent not found")

    widget_key = f"wk_{secrets.token_urlsafe(24)}"

    # Delete old key if exists, insert new
    db.table("widget_keys").delete().eq("agent_id", str(agent_id)).execute()
    result = (
        db.table("widget_keys")
        .insert({
            "tenant_id": tenant_id,
            "agent_id": str(agent_id),
            "widget_key": widget_key,
        })
        .execute()
    )
    return {"widget_key": widget_key}


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
            "custom_llm_url", "custom_llm_model", "escalation_config", "tuning",
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
