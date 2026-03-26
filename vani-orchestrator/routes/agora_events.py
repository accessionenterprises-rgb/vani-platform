"""
POST /agora/events — Agora Conversational AI webhook.

Agora sends transcript and lifecycle events here.
This mirrors the LiveKit /internal/events flow but for Agora-routed calls.
"""
import asyncio
import json
from typing import Optional

import structlog
from fastapi import APIRouter, Request
from pydantic import BaseModel

from db import get_db
from models.call_state import CallStatus
from redis_client import get_redis
from services.state_manager import load_call, update_status
from services.webhook_dispatcher import dispatch_event

logger = structlog.get_logger()
router = APIRouter(prefix="/agora", tags=["agora"])

POSTPROCESS_QUEUE = "vani:postprocess_queue"


@router.post("/events")
async def agora_webhook(request: Request):
    """
    Agora posts transcript + lifecycle events here.

    Agora event types:
    - agent.started: Agent joined channel and is ready
    - agent.stopped: Agent left the channel
    - transcript: Real-time transcript chunk
    - error: Agent error
    """
    try:
        body = await request.json()
    except Exception:
        return {"ok": False, "detail": "Invalid JSON"}

    event_type = body.get("type", body.get("event", ""))
    agent_id = body.get("agent_id", "")
    channel = body.get("channel", "")

    log = logger.bind(event_type=event_type, agora_agent_id=agent_id, channel=channel)
    log.info("agora_event_received", body_keys=list(body.keys()))

    # Look up call by agora channel name
    call_id = await _find_call_by_channel(channel)

    if event_type in ("agent.stopped", "agent_stopped"):
        if call_id:
            call = await load_call(call_id)
            if call and call.status not in (CallStatus.COMPLETED, CallStatus.FAILED):
                # Gather transcript from accumulated Redis buffer
                transcript = await _get_accumulated_transcript(call_id)
                duration_sec = body.get("duration", body.get("duration_sec"))

                await update_status(call_id, CallStatus.ENDING)
                _save_call_result(call_id, duration_sec, transcript)
                await update_status(call_id, CallStatus.POST_PROCESSING)
                await update_status(call_id, CallStatus.COMPLETED)

                asyncio.create_task(dispatch_event(
                    tenant_id=call.tenant_id,
                    event_type="call.ended",
                    payload={
                        "call_id": call_id,
                        "duration_sec": duration_sec,
                        "phone": call.phone,
                        "engine": "agora",
                    },
                ))

                # Release concurrency slot
                r = get_redis()
                await r.srem(f"inflight:{call.tenant_id}", call_id)

                # Enqueue post-processing
                if transcript:
                    job = {
                        "call_id": call_id,
                        "tenant_id": call.tenant_id,
                        "transcript": transcript,
                        "phone": call.phone,
                        "agent_id": call.agent_id,
                        "duration_sec": duration_sec,
                        "direction": "inbound",
                        "engine": "agora",
                    }
                    await r.lpush(POSTPROCESS_QUEUE, json.dumps(job))

                log.info("agora_call_completed", call_id=call_id, duration=duration_sec)

    elif event_type == "transcript":
        # Accumulate transcript chunks in Redis
        if call_id:
            text = body.get("text", body.get("content", ""))
            role = body.get("role", "user")
            if text:
                r = get_redis()
                entry = json.dumps({"role": role, "text": text})
                await r.rpush(f"agora:transcript:{call_id}", entry)
                await r.expire(f"agora:transcript:{call_id}", 7200)  # 2h TTL

    elif event_type in ("agent.started", "agent_started"):
        if call_id:
            call = await load_call(call_id)
            if call:
                asyncio.create_task(dispatch_event(
                    tenant_id=call.tenant_id,
                    event_type="call.started",
                    payload={
                        "call_id": call_id,
                        "phone": call.phone,
                        "agent_id": call.agent_id,
                        "engine": "agora",
                    },
                ))
                # Start Twilio recording
                if call.twilio_call_sid:
                    from routes.internal import _start_twilio_recording
                    asyncio.create_task(_start_twilio_recording(call_id, call.twilio_call_sid))

    elif event_type == "error":
        error_msg = body.get("message", body.get("error", "Unknown Agora error"))
        log.error("agora_agent_error", error=error_msg)
        if call_id:
            await update_status(call_id, CallStatus.FAILED, error=f"Agora: {error_msg}")

    return {"ok": True}


async def _find_call_by_channel(channel: str) -> str | None:
    """Look up call_id from Agora channel name via Redis."""
    if not channel:
        return None
    r = get_redis()
    call_id = await r.get(f"agora:channel:{channel}")
    if call_id:
        return call_id.decode() if isinstance(call_id, bytes) else call_id
    return None


async def _get_accumulated_transcript(call_id: str) -> str:
    """Build transcript string from accumulated chunks in Redis."""
    r = get_redis()
    key = f"agora:transcript:{call_id}"
    chunks = await r.lrange(key, 0, -1)
    if not chunks:
        return ""

    lines = []
    for chunk in chunks:
        try:
            data = json.loads(chunk)
            role = data.get("role", "user")
            text = data.get("text", "")
            prefix = "User" if role == "user" else "Agent"
            lines.append(f"{prefix}: {text}")
        except (json.JSONDecodeError, TypeError):
            pass

    # Clean up
    await r.delete(key)
    return "\n".join(lines)


def _save_call_result(call_id: str, duration_sec: int | None, transcript: str | None, agent_config: dict | None = None) -> None:
    try:
        from datetime import datetime, timezone
        db = get_db()
        update = {
            "status": "completed",
            "engine": "agora",
            "ended_at": datetime.now(timezone.utc).isoformat(),
        }
        if duration_sec is not None:
            update["duration_sec"] = duration_sec
        if transcript:
            update["transcript"] = transcript

        # Save provider info from agent config
        if agent_config:
            update["llm_provider"] = agent_config.get("llm")
            update["stt_provider"] = agent_config.get("stt")
            update["tts_provider"] = agent_config.get("tts")

        # If no agent_config passed, look up from the call's agent
        if not agent_config:
            call_row = db.table("calls").select("agent_id").eq("id", call_id).maybe_single().execute()
            if call_row.data and call_row.data.get("agent_id"):
                agent_row = db.table("agents").select("llm_provider,stt_provider,tts_provider").eq("id", call_row.data["agent_id"]).maybe_single().execute()
                if agent_row.data:
                    update["llm_provider"] = agent_row.data.get("llm_provider")
                    update["stt_provider"] = agent_row.data.get("stt_provider")
                    update["tts_provider"] = agent_row.data.get("tts_provider")

        db.table("calls").update(update).eq("id", call_id).execute()
    except Exception as exc:
        logger.error("agora_call_result_save_failed", call_id=call_id, error=str(exc))
