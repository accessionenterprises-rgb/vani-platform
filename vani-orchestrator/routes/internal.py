"""
POST /internal/events — engine → orchestrator event bus.

Engine sends lifecycle events here. No auth on this endpoint
(internal network only — not exposed to public internet in production).
"""
import asyncio
import json
import os
from typing import Optional

import httpx
import structlog
from fastapi import APIRouter
from pydantic import BaseModel

from db import get_db
from models.call_state import CallStatus
from redis_client import get_redis
from services.state_manager import load_call, update_status
from services.webhook_dispatcher import dispatch_event

logger = structlog.get_logger()
router = APIRouter(prefix="/internal", tags=["internal"])

VALID_EVENTS = {"CALL_STARTED", "USER_SPOKE", "AI_RESPONDED", "INTERRUPTION", "ESCALATION", "CALL_ENDED"}
POSTPROCESS_QUEUE = "vani:postprocess_queue"


class EngineEvent(BaseModel):
    type: str
    call_id: str
    data: Optional[dict] = None


@router.post("/events")
async def receive_event(event: EngineEvent):
    log = logger.bind(call_id=event.call_id, event_type=event.type)

    if event.type not in VALID_EVENTS:
        log.warning("unknown_event_type")
        return {"ok": False, "detail": "Unknown event type"}

    if event.type == "CALL_STARTED":
        call = await load_call(event.call_id)
        if call:
            asyncio.create_task(dispatch_event(
                tenant_id=call.tenant_id,
                event_type="call.started",
                payload={"call_id": event.call_id, "phone": call.phone, "agent_id": call.agent_id},
            ))
            # Start recording inbound calls via Twilio REST API
            if call.twilio_call_sid:
                asyncio.create_task(_start_twilio_recording(
                    call_id=event.call_id,
                    call_sid=call.twilio_call_sid,
                ))

    elif event.type == "ESCALATION":
        data = event.data or {}
        transfer_number = data.get("transfer_number")
        if transfer_number:
            asyncio.create_task(_execute_transfer(
                call_id=event.call_id,
                transfer_number=transfer_number,
                whisper_text=data.get("whisper_text"),
                agent_name=data.get("agent_name"),
            ))
            log.info("escalation_transfer_triggered", to=transfer_number)
        else:
            log.warning("escalation_no_transfer_number")

    elif event.type == "CALL_ENDED":
        data = event.data or {}
        call = await update_status(event.call_id, CallStatus.ENDING)
        if call:
            _save_call_result(
                call_id=event.call_id,
                duration_sec=data.get("duration_sec"),
                transcript=data.get("transcript"),
            )

            # Save provider latency metrics
            latency = data.get("latency_profile")
            if latency and latency.get("samples", 0) > 0:
                try:
                    db = get_db()
                    db.table("provider_latency").insert({
                        "tenant_id":    call.tenant_id,
                        "stt_provider": data.get("stt_provider", ""),
                        "llm_provider": data.get("llm_provider", ""),
                        "tts_provider": data.get("tts_provider", ""),
                        "avg_ms":       latency.get("avg_ms"),
                        "p50_ms":       latency.get("p50_ms"),
                        "p95_ms":       latency.get("p95_ms"),
                        "min_ms":       latency.get("min_ms"),
                        "max_ms":       latency.get("max_ms"),
                        "samples":      latency.get("samples"),
                        "duration_sec": data.get("duration_sec", 0),
                    }).execute()
                except Exception as e:
                    log.warning("latency_save_failed", error=str(e))

            await update_status(event.call_id, CallStatus.POST_PROCESSING)
            await update_status(event.call_id, CallStatus.COMPLETED)
            log.info("call_completed",
                     duration=data.get("duration_sec"),
                     transcript_len=len(data.get("transcript", "")))

            asyncio.create_task(dispatch_event(
                tenant_id=call.tenant_id,
                event_type="call.ended",
                payload={
                    "call_id": event.call_id,
                    "duration_sec": data.get("duration_sec"),
                    "phone": call.phone,
                },
            ))

            # Release concurrency slot
            r = get_redis()
            await r.srem(f"inflight:{call.tenant_id}", event.call_id)

            if data.get("transcript"):
                job = {
                    "call_id":         event.call_id,
                    "tenant_id":       call.tenant_id,
                    "transcript":      data["transcript"],
                    "phone":           call.phone,
                    "agent_id":        call.agent_id,
                    # Provider info for cost calculation
                    "duration_sec":    data.get("duration_sec"),
                    "stt_provider":    data.get("stt_provider", ""),
                    "llm_provider":    data.get("llm_provider", ""),
                    "tts_provider":    data.get("tts_provider", ""),
                    "direction":       data.get("direction", "inbound"),
                    # Latency profile from engine
                    "latency_profile": data.get("latency_profile"),
                }
                await r.lpush(POSTPROCESS_QUEUE, json.dumps(job))
                log.info("post_process_enqueued")

    log.info("event_received")
    return {"ok": True}


async def _start_twilio_recording(call_id: str, call_sid: str) -> None:
    """Start recording an in-progress inbound Twilio call."""
    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    auth_token  = os.getenv("TWILIO_AUTH_TOKEN", "")
    if not account_sid or not auth_token:
        return
    orchestrator_url = os.getenv("ORCHESTRATOR_PUBLIC_URL", "https://orchestrator.vani.live")
    recording_cb = f"{orchestrator_url}/telephony/recording-status"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Calls/{call_sid}/Recordings.json",
                auth=(account_sid, auth_token),
                data={
                    "RecordingStatusCallback": recording_cb,
                    "RecordingStatusCallbackMethod": "POST",
                },
            )
        logger.info("twilio_recording_started", call_id=call_id)
    except Exception as exc:
        logger.warning("twilio_recording_failed", call_id=call_id, error=str(exc))


async def _execute_transfer(call_id: str, transfer_number: str,
                             whisper_text: Optional[str] = None,
                             agent_name: Optional[str] = None) -> None:
    """Call our own transfer endpoint to patch the live Twilio call."""
    orchestrator_url = os.getenv("ORCHESTRATOR_URL", "http://localhost:8001")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"{orchestrator_url}/internal/transfer/{call_id}",
                json={
                    "transfer_number": transfer_number,
                    "whisper_text": whisper_text,
                    "agent_name": agent_name,
                },
            )
    except Exception as exc:
        logger.error("escalation_transfer_failed", call_id=call_id, error=str(exc))


def _save_call_result(call_id: str, duration_sec: int | None, transcript: str | None) -> None:
    try:
        db = get_db()
        update = {"status": "completed"}
        if duration_sec is not None:
            update["duration_sec"] = duration_sec
        if transcript:
            update["transcript"] = transcript
        db.table("calls").update(update).eq("id", call_id).execute()
    except Exception as exc:
        logger.error("call_result_save_failed", call_id=call_id, error=str(exc))
