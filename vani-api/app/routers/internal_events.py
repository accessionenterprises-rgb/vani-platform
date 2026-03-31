"""Internal events from vani-engine — no auth (same server only).
Handles CALL_STARTED and CALL_ENDED to persist calls + transcripts to Supabase.
"""
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.db import get_db

router = APIRouter(prefix="/internal", tags=["Internal"])


class EventPayload(BaseModel):
    type: str
    call_id: Optional[str] = None
    data: dict = {}


@router.post("/events")
async def handle_event(payload: EventPayload):
    db = get_db()
    event = payload.type
    data  = payload.data
    call_id = payload.call_id or data.get("call_id") or str(uuid4())

    if event == "CALL_STARTED":
        tenant_id = data.get("tenant_id", "")
        agent_id  = data.get("agent_id") or None
        phone     = data.get("phone", "")
        direction = data.get("direction", "inbound")
        room      = data.get("room", "")

        if not tenant_id:
            return {"ok": False, "reason": "missing tenant_id"}

        db.table("calls").insert({
            "id":          call_id,
            "tenant_id":   tenant_id,
            "agent_id":    agent_id,
            "phone":       phone,
            "direction":   direction,
            "status":      "active",
            "livekit_room": room,
            "started_at":  datetime.now(timezone.utc).isoformat(),
            "created_at":  datetime.now(timezone.utc).isoformat(),
            "metadata":    {},
        }).execute()
        return {"ok": True, "call_id": call_id}

    elif event == "CALL_ENDED":
        duration_sec = data.get("duration_sec")
        transcript   = data.get("transcript", "")
        turn_count   = data.get("turn_count", 0)
        usage        = data.get("usage", {})
        latency      = data.get("latency_profile", {})

        db.table("calls").update({
            "status":       "completed",
            "duration_sec": duration_sec,
            "transcript":   transcript,
            "ended_at":     datetime.now(timezone.utc).isoformat(),
            "metadata": {
                "turn_count":    turn_count,
                "stt_provider":  data.get("stt_provider", ""),
                "llm_provider":  data.get("llm_provider", ""),
                "tts_provider":  data.get("tts_provider", ""),
                "usage":         usage,
                "latency":       latency,
            },
        }).eq("id", call_id).execute()
        return {"ok": True}

    elif event == "ESCALATION":
        db.table("calls").update({
            "metadata": {"escalated": True, "transfer_number": data.get("transfer_number", "")},
        }).eq("id", call_id).execute()
        return {"ok": True}

    return {"ok": True, "ignored": event}
