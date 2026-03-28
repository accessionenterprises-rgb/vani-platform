"""
Telephony inbound handlers.

For LiveKit engine: Twilio/Vobiz calls go directly to LiveKit via SIP.
This route handles:
  1. Twilio webhook → returns TwiML with SIP dial to LiveKit
  2. Vobiz webhook → returns XML with SIP dial to LiveKit
  3. Recording status callback from Twilio
  4. Rate limiting + call logging
"""
import uuid

import structlog
from fastapi import APIRouter, Form, Request
from fastapi.responses import Response

from config import settings
from db import get_db
from redis_client import get_redis

logger = structlog.get_logger()

router = APIRouter(prefix="/telephony", tags=["telephony"])

# LiveKit SIP URI from project settings
LIVEKIT_SIP_HOST = "1kf73cgub7v.sip.livekit.cloud"

# ── TwiML Templates ─────────────────────────────────────────────────────────

BUSY_TWIML = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Sorry, all agents are busy. Please try again shortly.</Say>
  <Hangup/>
</Response>"""

RATE_LIMITED_TWIML = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Too many calls. Please wait a moment and try again.</Say>
  <Hangup/>
</Response>"""


def _twiml_response(content: str) -> Response:
    return Response(content=content, media_type="application/xml")


async def _check_rate_limit(from_number: str) -> bool:
    """Max 10 calls/min per source number."""
    if not from_number:
        return False
    r = get_redis()
    key = f"rl:call:{from_number}"
    count = await r.incr(key)
    if count == 1:
        await r.expire(key, 60)
    return count > 10


async def _lookup_agent(to_number: str) -> dict | None:
    """Find tenant + agent for an inbound phone number."""
    num = to_number.strip()
    if num and not num.startswith("+"):
        num = f"+{num}"
    try:
        db = get_db()
        result = (
            db.table("phone_numbers")
            .select("tenant_id, agent_id, engine, agents(id, name, greeting, prompt, language, voice, stt_provider, llm_provider, tts_provider, behavior, tuning, active)")
            .eq("number", num)
            .eq("status", "active")
            .maybe_single()
            .execute()
        )
        if result is None:
            return None
        return result.data
    except Exception as e:
        logger.error("phone_lookup_failed", number=num, error=str(e))
        return None


# ── Twilio Inbound ───────────────────────────────────────────────────────────

@router.post("/inbound")
async def twilio_inbound(
    request: Request,
    CallSid: str = Form(default=""),
    From: str = Form(default=""),
    To: str = Form(default=""),
):
    """Twilio voice webhook — returns TwiML to dial LiveKit SIP."""
    log = logger.bind(call_sid=CallSid, from_number=From, to_number=To)
    log.info("inbound_call")

    # Rate limit
    if await _check_rate_limit(From):
        log.warning("rate_limit_exceeded")
        return _twiml_response(RATE_LIMITED_TWIML)

    # Lookup agent
    mapping = await _lookup_agent(To)
    if mapping is None or not mapping.get("agents"):
        log.warning("no_agent_for_number", to=To)
        return _twiml_response(BUSY_TWIML)

    agent_row = mapping["agents"]
    if not agent_row.get("active", False):
        log.warning("agent_inactive", agent_id=agent_row["id"])
        return _twiml_response(BUSY_TWIML)

    # Log call to Supabase
    call_id = str(uuid.uuid4())
    try:
        db = get_db()
        db.table("calls").insert({
            "id": call_id,
            "tenant_id": mapping["tenant_id"],
            "agent_id": mapping["agent_id"],
            "phone": From,
            "direction": "inbound",
            "status": "connecting",
            "engine": "livekit",
            "metadata": {"twilio_call_sid": CallSid},
        }).execute()
    except Exception as e:
        log.error("call_log_failed", error=str(e))

    # Return TwiML — dial LiveKit SIP directly
    sip_number = To.lstrip("+") if To else ""
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="120">
    <Sip>sip:{sip_number}@{LIVEKIT_SIP_HOST};transport=tcp</Sip>
  </Dial>
</Response>"""

    log.info("sip_twiml_served", call_id=call_id, sip_host=LIVEKIT_SIP_HOST)
    return _twiml_response(twiml)


# ── Vobiz Inbound ────────────────────────────────────────────────────────────

VOBIZ_BUSY_XML = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak>Sorry, all agents are busy. Please try again shortly.</Speak>
  <Hangup/>
</Response>"""

@router.post("/vobiz/inbound")
async def vobiz_inbound(request: Request):
    """Vobiz inbound voice webhook — returns XML to dial LiveKit SIP."""
    body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else dict(await request.form())

    call_sid = body.get("CallSid") or body.get("call_sid") or body.get("CallUUID") or str(uuid.uuid4())
    from_num = body.get("From") or body.get("from") or body.get("caller_id") or ""
    to_num = body.get("To") or body.get("to") or body.get("called_number") or ""

    log = logger.bind(call_sid=call_sid, from_number=from_num, to_number=to_num, provider="vobiz")
    log.info("vobiz_inbound_call")

    # Lookup agent
    mapping = await _lookup_agent(to_num)
    if mapping is None or not mapping.get("agents"):
        log.warning("no_agent_for_number", to=to_num)
        return Response(content=VOBIZ_BUSY_XML, media_type="application/xml")

    agent_row = mapping["agents"]
    if not agent_row.get("active", False):
        log.warning("agent_inactive", agent_id=agent_row["id"])
        return Response(content=VOBIZ_BUSY_XML, media_type="application/xml")

    # Log call to Supabase
    call_id = str(uuid.uuid4())
    try:
        db = get_db()
        db.table("calls").insert({
            "id": call_id,
            "tenant_id": mapping["tenant_id"],
            "agent_id": mapping["agent_id"],
            "phone": from_num,
            "direction": "inbound",
            "status": "connecting",
            "engine": "livekit",
            "metadata": {"vobiz_call_sid": call_sid},
        }).execute()
    except Exception as e:
        log.error("call_log_failed", error=str(e))

    # Vobiz: SIP trunk handles routing via inbound_destination
    # No XML response needed — Vobiz forwards to LiveKit directly
    # But if this endpoint is called (application mode), return hold XML
    log.info("vobiz_call_logged", call_id=call_id)
    return Response(
        content=f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak>Please hold while we connect your call.</Speak>
  <Wait length="60"/>
</Response>""",
        media_type="application/xml",
    )


# ── Vobiz Hangup ────────────────────────────────────────────────────────────

@router.post("/vobiz/hangup")
async def vobiz_hangup(request: Request):
    """Vobiz hangup callback."""
    body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else dict(await request.form())
    call_sid = body.get("CallUUID") or body.get("CallSid") or ""
    logger.info("vobiz_hangup", call_sid=call_sid)
    return {"ok": True}


# ── Twilio Recording Status ─────────────────────────────────────────────────

@router.post("/recording-status")
async def recording_status(
    request: Request,
    CallSid: str = Form(default=""),
    RecordingUrl: str = Form(default=""),
    RecordingStatus: str = Form(default="completed"),
):
    """Twilio posts here when a recording is ready."""
    if RecordingStatus != "completed":
        return {"ok": True}
    try:
        db = get_db()
        db.table("calls").update({"recording_url": RecordingUrl}).eq("metadata->>twilio_call_sid", CallSid).execute()
        logger.info("recording_saved", call_sid=CallSid)
    except Exception as e:
        logger.error("recording_save_failed", error=str(e))
    return {"ok": True}
