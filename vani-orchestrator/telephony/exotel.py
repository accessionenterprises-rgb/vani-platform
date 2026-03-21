"""
Exotel telephony provider — inbound webhook handler.

Exotel sends a POST with form data when a call arrives:
  CallSid, From (caller), To (your number), Status, Direction, AccountSid, etc.

ExoML response (subset of TwiML):
  <Response><Say>text</Say><Pause length="N"/></Response>
"""
import json
import uuid

import structlog
from fastapi import APIRouter, Form, Request
from fastapi.responses import Response

from db import get_db
from models.call_state import CallState, CallStatus
from redis_client import get_redis
from services.state_manager import save_call, set_idempotency_key, get_call_id_by_sid

logger = structlog.get_logger()

router = APIRouter(prefix="/telephony", tags=["telephony"])

HOLD_EXOML = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Please hold while we connect your call.</Say>
  <Pause length="55"/>
</Response>"""

BUSY_EXOML = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, all agents are busy. Please try again shortly.</Say>
  <Hangup/>
</Response>"""


def _exoml_response(content: str) -> Response:
    return Response(content=content, media_type="application/xml")


async def _lookup_agent(to_number: str) -> dict | None:
    try:
        db = get_db()
        result = (
            db.table("phone_numbers")
            .select("tenant_id, agent_id, agents(id, name, active)")
            .eq("number", to_number)
            .eq("status", "active")
            .maybe_single()
            .execute()
        )
        return result.data
    except Exception as e:
        logger.error("exotel_phone_lookup_failed", number=to_number, error=str(e))
        return None


@router.post("/inbound/exotel")
async def exotel_inbound(
    request: Request,
    CallSid: str = Form(...),
    From: str = Form(...),
    To: str = Form(...),
    Status: str = Form(default="ringing"),
    Direction: str = Form(default="inbound"),
):
    """Exotel inbound webhook — mirrors Twilio handler but returns ExoML."""
    log = logger.bind(call_sid=CallSid, from_number=From, to_number=To, provider="exotel")
    log.info("exotel_inbound_call")

    # Idempotency
    existing_call_id = await get_call_id_by_sid(CallSid)
    if existing_call_id:
        log.info("duplicate_exotel_retry", existing_call_id=existing_call_id)
        return _exoml_response(HOLD_EXOML)

    mapping = await _lookup_agent(To)
    if mapping is None or not mapping.get("agents"):
        log.warning("no_agent_for_number", to=To)
        return _exoml_response(BUSY_EXOML)

    agent_row = mapping["agents"]
    if not agent_row.get("active", False):
        return _exoml_response(BUSY_EXOML)

    call_id = str(uuid.uuid4())
    call = CallState(
        call_id         = call_id,
        tenant_id       = mapping["tenant_id"],
        agent_id        = mapping["agent_id"],
        phone           = From,
        status          = CallStatus.INCOMING,
        twilio_call_sid = CallSid,  # reuse field for Exotel CallSid
    )
    await save_call(call)
    await set_idempotency_key(CallSid, call_id)

    # Tier
    r = get_redis()
    try:
        db = get_db()
        tenant = db.table("tenants").select("plan").eq("id", mapping["tenant_id"]).maybe_single().execute()
        plan = tenant.data.get("plan", "starter") if tenant.data else "starter"
    except Exception:
        plan = "starter"

    queue = "vani:queue:enterprise" if plan == "enterprise" else "vani:queue:standard"
    job = {"call_id": call_id}
    await r.lpush(queue, json.dumps(job))
    log.info("exotel_job_enqueued", call_id=call_id, queue=queue)

    return _exoml_response(HOLD_EXOML)
