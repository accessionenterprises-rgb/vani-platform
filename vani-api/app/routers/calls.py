"""Calls log endpoints — list + get transcript + supervisor monitor token + AI QA."""
import json
import os
import time
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from app.config import settings
from app.db import get_db
from app.middleware.auth import get_tenant_id

router = APIRouter(prefix="/calls", tags=["Calls"])


class CallResponse(BaseModel):
    model_config = {"extra": "ignore"}
    id: str
    tenant_id: str
    agent_id: Optional[str]
    phone: Optional[str]
    direction: str
    status: str
    duration_sec: Optional[int]
    sentiment: Optional[str]
    summary: Optional[str]
    livekit_room: Optional[str]
    metadata: dict
    started_at: Optional[str]
    ended_at: Optional[str]
    created_at: str


class CallDetailResponse(CallResponse):
    transcript: Optional[str]


def _row_to_call(row: dict, include_transcript: bool = False):
    base = {
        "id": str(row["id"]),
        "tenant_id": row["tenant_id"],
        "agent_id": str(row["agent_id"]) if row.get("agent_id") else None,
        "phone": row.get("phone"),
        "direction": row["direction"],
        "status": row["status"],
        "duration_sec": row.get("duration_sec"),
        "sentiment": row.get("sentiment"),
        "summary": row.get("summary"),
        "livekit_room": row.get("livekit_room"),
        "metadata": row.get("metadata") or {},
        "started_at": str(row["started_at"]) if row.get("started_at") else None,
        "ended_at": str(row["ended_at"]) if row.get("ended_at") else None,
        "created_at": str(row["created_at"]),
    }
    if include_transcript:
        base["transcript"] = row.get("transcript")
        return CallDetailResponse(**base)
    return CallResponse(**base)


@router.get("", response_model=list[CallResponse])
async def list_calls(
    agent_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    tenant_id: str = Depends(get_tenant_id),
):
    db = get_db()
    q = (
        db.table("calls")
        .select("id,tenant_id,agent_id,phone,direction,status,duration_sec,sentiment,summary,livekit_room,metadata,started_at,ended_at,created_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .limit(limit)
    )
    if agent_id:
        q = q.eq("agent_id", str(agent_id))
    if status:
        q = q.eq("status", status)
    result = q.execute()
    return [_row_to_call(r) for r in result.data]


@router.get("/{call_id}", response_model=CallDetailResponse)
async def get_call(call_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    db = get_db()
    result = (
        db.table("calls")
        .select("*")
        .eq("id", str(call_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if result.data is None:
        raise HTTPException(status_code=404, detail="Call not found")
    return _row_to_call(result.data, include_transcript=True)


@router.get("/{call_id}/monitor-token")
async def get_monitor_token(call_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    """
    Returns a LiveKit token for supervisor listen-in (read-only, cannot publish).
    Only works while the call is active (status = active | connecting | routing).
    """
    db = get_db()
    result = (
        db.table("calls")
        .select("id, tenant_id, livekit_room, status")
        .eq("id", str(call_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if result.data is None:
        raise HTTPException(status_code=404, detail="Call not found")

    call = result.data
    if call["status"] not in ("routing", "connecting", "active"):
        raise HTTPException(status_code=400, detail="Call is not active")

    room_name = call.get("livekit_room")
    if not room_name:
        raise HTTPException(status_code=400, detail="No LiveKit room assigned to this call")

    livekit_api_key    = os.getenv("LIVEKIT_API_KEY", "")
    livekit_api_secret = os.getenv("LIVEKIT_API_SECRET", "")
    if not livekit_api_key or not livekit_api_secret:
        raise HTTPException(status_code=500, detail="LiveKit credentials not configured")

    try:
        from livekit import api as lk_api
        token = (
            lk_api.AccessToken(livekit_api_key, livekit_api_secret)
            .with_identity(f"supervisor-{tenant_id[:8]}")
            .with_name("Supervisor")
            .with_grants(lk_api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=False,
                can_subscribe=True,
                can_publish_data=False,
            ))
            .to_jwt()
        )
        livekit_url = os.getenv("LIVEKIT_URL", "")
        return {"token": token, "room": room_name, "livekit_url": livekit_url}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Token generation failed: {exc}")


class QAResponse(BaseModel):
    professionalism: int
    empathy: int
    resolution: int
    adherence: int
    summary: str
    flags: list[str]


_QA_PROMPT = """You are a call quality analyst reviewing a voice AI call transcript.

Score the AI agent (not the human caller) on each dimension from 1–10:
- professionalism: tone, language quality, politeness
- empathy: understanding and acknowledging the caller's needs
- resolution: whether the caller's issue was addressed or resolved
- adherence: staying on topic and following its role/guidelines

Also write a brief 1–2 sentence summary of the call quality, and list up to 3 specific flags (issues or improvements).

Respond ONLY with valid JSON in this exact format:
{
  "professionalism": <1-10>,
  "empathy": <1-10>,
  "resolution": <1-10>,
  "adherence": <1-10>,
  "summary": "<string>",
  "flags": ["<flag1>", "<flag2>"]
}

TRANSCRIPT:
{transcript}"""


@router.post("/{call_id}/qa", response_model=QAResponse)
async def run_call_qa(call_id: UUID, tenant_id: str = Depends(get_tenant_id)):
    """Run AI quality analysis on a completed call's transcript."""
    db = get_db()
    result = (
        db.table("calls")
        .select("id, tenant_id, transcript, status")
        .eq("id", str(call_id))
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if result.data is None:
        raise HTTPException(status_code=404, detail="Call not found")

    call = result.data
    transcript = call.get("transcript", "")
    if not transcript or len(transcript.strip()) < 20:
        raise HTTPException(status_code=400, detail="Call has no transcript to analyse")

    # Use configured LLM — fall back to a simple Gemini call via Google's API
    llm_key = os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_API_KEY", "")
    openai_key = os.getenv("OPENAI_API_KEY", "")

    prompt = _QA_PROMPT.replace("{transcript}", transcript[:8000])

    if openai_key:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {openai_key}"},
                json={"model": "gpt-4o-mini", "messages": [{"role": "user", "content": prompt}], "max_tokens": 400},
            )
        r.raise_for_status()
        text = r.json()["choices"][0]["message"]["content"]
    elif llm_key:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={llm_key}",
                json={"contents": [{"parts": [{"text": prompt}]}]},
            )
        r.raise_for_status()
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
    else:
        # Fallback: return a dummy neutral score
        return QAResponse(
            professionalism=7, empathy=7, resolution=7, adherence=7,
            summary="LLM not configured — unable to run AI QA. Set OPENAI_API_KEY or GEMINI_API_KEY.",
            flags=["Configure an LLM key to enable real QA analysis"],
        )

    # Parse JSON from LLM response
    try:
        json_match = text.strip()
        start = json_match.find("{")
        end   = json_match.rfind("}") + 1
        data  = json.loads(json_match[start:end])
        return QAResponse(
            professionalism=int(data.get("professionalism", 7)),
            empathy=int(data.get("empathy", 7)),
            resolution=int(data.get("resolution", 7)),
            adherence=int(data.get("adherence", 7)),
            summary=str(data.get("summary", "")),
            flags=[str(f) for f in data.get("flags", [])],
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to parse QA response from LLM")
