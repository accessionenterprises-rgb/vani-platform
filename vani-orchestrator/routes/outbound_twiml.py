"""
Outbound telephony callbacks.

POST /telephony/outbound/answered/{call_id}
  → Twilio calls this when the recipient picks up
  → Checks AMD result (AnsweredBy) — if voicemail, schedule retry
  → Creates LiveKit room + dispatches engine for human calls
  → Returns TwiML hold while engine connects

POST /telephony/outbound/status/{call_id}
  → Twilio status callbacks (initiated/ringing/answered/completed/busy/no-answer)
  → Handles no-answer + busy → schedule retry
"""
import json
from datetime import datetime, timezone, timedelta

import structlog
from fastapi import APIRouter, Form, Request
from fastapi.responses import Response

from db import get_db
from redis_client import get_redis
from services import livekit_manager
from services.state_manager import load_call, save_call, update_status
from models.call_state import CallState, CallStatus

logger = structlog.get_logger()

router = APIRouter(prefix="/telephony/outbound", tags=["outbound-telephony"])

HOLD_TWIML = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi">Please hold for a moment.</Say>
  <Pause length="55"/>
</Response>"""

HANGUP_TWIML = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup/>
</Response>"""


def _twiml(content: str) -> Response:
    return Response(content=content, media_type="application/xml")


async def _schedule_retry(call_id: str, outcome: str, job_data: dict, db) -> None:
    """
    Increment attempts on campaign_contact. If under max → schedule retry.
    If at max → mark failed. If not a campaign call → just mark call failed.
    """
    campaign_contact_id = job_data.get("campaign_contact_id")
    retry_config = job_data.get("retry_config") or {}
    max_attempts   = int(retry_config.get("max_attempts")   or 3)
    retry_delay_min = int(retry_config.get("retry_delay_min") or 60)

    db.table("calls").update({
        "status": "failed",
        "metadata": {"last_outcome": outcome},
        "ended_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", call_id).execute()

    if not campaign_contact_id:
        return

    contact_row = (
        db.table("campaign_contacts")
        .select("attempts")
        .eq("id", campaign_contact_id)
        .maybe_single()
        .execute()
    )
    if contact_row.data is None:
        return

    attempts = (contact_row.data.get("attempts") or 0) + 1

    if attempts >= max_attempts:
        db.table("campaign_contacts").update({
            "status": "failed",
            "attempts": attempts,
            "last_outcome": outcome,
            "attempted_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", campaign_contact_id).execute()
        logger.info("contact_max_attempts_reached",
                    contact_id=campaign_contact_id, attempts=attempts, outcome=outcome)
    else:
        next_retry_at = (datetime.now(timezone.utc) + timedelta(minutes=retry_delay_min)).isoformat()
        db.table("campaign_contacts").update({
            "status": "retry",
            "attempts": attempts,
            "last_outcome": outcome,
            "next_retry_at": next_retry_at,
            "attempted_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", campaign_contact_id).execute()
        logger.info("contact_retry_scheduled",
                    contact_id=campaign_contact_id, attempts=attempts,
                    outcome=outcome, next_retry_at=next_retry_at)


@router.post("/answered/{call_id}")
@router.get("/answered/{call_id}")
async def outbound_answered(
    call_id: str,
    request: Request,
    AnsweredBy: str = Form(default="human"),
):
    """
    Twilio calls this when the outbound call is answered.

    AnsweredBy values (MachineDetection=Enable):
      human              → proceed, dispatch engine
      machine_start      → voicemail detected early, hang up + retry
      machine_end_beep   → voicemail beep detected, hang up + retry
      machine_end_other  → machine greeting ended, hang up + retry
      fax / unknown      → hang up + retry
    """
    log = logger.bind(call_id=call_id, answered_by=AnsweredBy)
    log.info("outbound_answered")

    r = get_redis()
    db = get_db()

    # Check cancel signal
    if await r.exists(f"cancel:{call_id}"):
        log.info("outbound_answered_but_cancelled")
        return _twiml(HANGUP_TWIML)

    # Load full job data from Redis
    raw_cfg = await r.get(f"outbound_cfg:{call_id}")
    if not raw_cfg:
        log.error("outbound_cfg_not_found")
        return _twiml(HANGUP_TWIML)

    job_data = json.loads(raw_cfg)
    # Backwards compat: old format stored only agent_config directly
    agent_config = job_data.get("agent_config") or job_data

    # AMD: voicemail detected → schedule retry and hang up
    if AnsweredBy.lower().startswith("machine") or AnsweredBy.lower() in ("fax",):
        log.info("voicemail_detected", answered_by=AnsweredBy)
        await _schedule_retry(call_id, "voicemail", job_data, db)
        return _twiml(HANGUP_TWIML)

    # Load DB call to get tenant + agent IDs
    call_row = (
        db.table("calls")
        .select("id, tenant_id, agent_id, phone")
        .eq("id", call_id)
        .maybe_single()
        .execute()
    )
    if call_row.data is None:
        log.error("outbound_call_not_found")
        return _twiml(HANGUP_TWIML)

    call_data = call_row.data

    # Create LiveKit room
    try:
        room_name = await livekit_manager.create_room()
    except Exception as e:
        log.error("room_creation_failed", error=str(e))
        db.table("calls").update({"status": "failed"}).eq("id", call_id).execute()
        return _twiml(HANGUP_TWIML)

    # Dispatch engine
    agent_payload = {
        "call_id":      call_id,
        "tenant_id":    call_data["tenant_id"],
        "agent_id":     call_data["agent_id"],
        "room":         room_name,
        "direction":    "outbound",
        "agent_config": agent_config,
    }
    try:
        await livekit_manager.dispatch_agent(room_name, agent_payload)
    except Exception as e:
        log.error("agent_dispatch_failed", error=str(e))
        db.table("calls").update({"status": "failed"}).eq("id", call_id).execute()
        return _twiml(HANGUP_TWIML)

    db.table("calls").update({"status": "active", "livekit_room": room_name}).eq("id", call_id).execute()
    log.info("outbound_engine_dispatched", room=room_name)

    return _twiml(HOLD_TWIML)


@router.post("/status/{call_id}")
async def outbound_status(
    call_id: str,
    CallStatus: str = Form(default=""),
    CallSid: str = Form(default=""),
    request: Request = None,
):
    """
    Twilio status callbacks.
    no-answer / busy → schedule retry if campaign call, else fail
    failed → fail
    completed → handled by engine teardown
    """
    log = logger.bind(call_id=call_id, twilio_status=CallStatus)
    terminal = {"completed", "no-answer", "busy", "failed", "canceled"}
    retry_triggers = {"no-answer", "busy"}

    if CallStatus.lower() not in terminal:
        return Response(status_code=200)

    db = get_db()
    row = db.table("calls").select("status").eq("id", call_id).maybe_single().execute()
    if not row.data or row.data["status"] in ("completed", "failed", "cancelled"):
        return Response(status_code=200)

    status_lower = CallStatus.lower()

    if status_lower in retry_triggers:
        r = get_redis()
        raw_cfg = await r.get(f"outbound_cfg:{call_id}")
        if raw_cfg:
            job_data = json.loads(raw_cfg)
            await _schedule_retry(call_id, status_lower, job_data, db)
        else:
            db.table("calls").update({"status": "failed"}).eq("id", call_id).execute()
        log.info("outbound_retry_triggered", outcome=status_lower)

    elif status_lower in ("failed", "canceled"):
        db.table("calls").update({"status": "failed"}).eq("id", call_id).execute()
        log.info("outbound_terminal_failed")

    # "completed" is left alone — engine handles its own teardown

    return Response(status_code=200)
