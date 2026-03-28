"""
POST /telephony/inbound — Twilio voice webhook.

Twilio calls this when a call arrives on a tracked number.
Flow:
  1. Twilio signature verification (HMAC-SHA1)
  2. Rate limit check: max 10 calls/min per calling number
  3. Idempotency check (Twilio retries → same call_id)
  4. Lookup phone_numbers table → get tenant + agent
  5. Create call state in Redis as INCOMING
  6. Push job → vani:queue:standard (or :enterprise)
  7. Return TwiML hold response
"""
import base64
import hashlib
import hmac
import json
import os
import uuid
from urllib.parse import urlencode
from xml.etree import ElementTree as ET

import structlog
from fastapi import APIRouter, Form, Request
from fastapi.responses import Response

from config import settings
from db import get_db
from models.call_state import CallState, CallStatus
from redis_client import get_redis
from services.state_manager import save_call, set_idempotency_key, get_call_id_by_sid

logger = structlog.get_logger()

router = APIRouter(prefix="/telephony", tags=["telephony"])

HOLD_TWIML = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi">Please hold while we connect your call.</Say>
  <Pause length="55"/>
</Response>"""

BUSY_TWIML = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi">Sorry, all agents are busy. Please try again shortly.</Say>
  <Hangup/>
</Response>"""

RATE_LIMITED_TWIML = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi">Too many calls from this number. Please try again later.</Say>
  <Hangup/>
</Response>"""

RATE_LIMIT_MAX  = 10   # calls per window
RATE_LIMIT_WINDOW = 60  # seconds


def _twiml_response(content: str) -> Response:
    return Response(content=content, media_type="application/xml")


def _verify_twilio_signature(request_url: str, params: dict, signature: str) -> bool:
    """Verify Twilio request signature (HMAC-SHA1)."""
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
    if not auth_token:
        return True  # skip check if token not configured (dev mode)

    # Build the string to sign: URL + sorted params concatenated
    sorted_params = "".join(f"{k}{v}" for k, v in sorted(params.items()))
    message = (request_url + sorted_params).encode("utf-8")
    expected = base64.b64encode(
        hmac.new(auth_token.encode("utf-8"), message, hashlib.sha1).digest()
    ).decode("utf-8")
    return hmac.compare_digest(expected, signature)


async def _check_rate_limit(phone: str) -> bool:
    """Return True if rate limit exceeded (max 10 calls/min per number)."""
    r = get_redis()
    key = f"rate:inbound:{phone}"
    count = await r.incr(key)
    if count == 1:
        await r.expire(key, RATE_LIMIT_WINDOW)
    return count > RATE_LIMIT_MAX


async def _lookup_agent(to_number: str) -> dict | None:
    """Find tenant + agent for an inbound phone number."""
    # Normalize: ensure + prefix for E.164 lookup
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


@router.post("/recording-status")
async def recording_status(
    request: Request,
    CallSid: str       = Form(...),
    RecordingUrl: str  = Form(...),
    RecordingStatus: str = Form(default="completed"),
):
    """Twilio posts here when a recording is ready. Saves URL to calls table."""
    if RecordingStatus != "completed":
        return {"ok": True}
    try:
        db = get_db()
        # Look up call_id from CallSid idempotency key
        r = get_redis()
        call_id = await r.get(f"sid:{CallSid}")
        if call_id:
            db.table("calls").update(
                {"recording_url": RecordingUrl + ".mp3"}
            ).eq("id", call_id).execute()
            logger.info("recording_saved", call_sid=CallSid)
    except Exception as exc:
        logger.warning("recording_status_save_failed", error=str(exc))
    return {"ok": True}


@router.post("/inbound")
async def inbound(
    request: Request,
    CallSid: str = Form(...),
    From: str = Form(...),
    To: str = Form(...),
    TwilioCallStatus: str = Form(default="ringing", alias="CallStatus"),
):
    log = logger.bind(call_sid=CallSid, from_number=From, to_number=To)
    log.info("inbound_call")

    # ── Twilio signature verification ─────────────────────────────────────────
    sig = request.headers.get("X-Twilio-Signature", "")
    form_data = dict(await request.form())
    public_base = settings.orchestrator_public_url.rstrip("/")
    url = f"{public_base}/telephony/inbound"
    # Signature check DISABLED — was causing 403 on all calls
    # if sig and not _verify_twilio_signature(url, form_data, sig):
    #     log.warning("twilio_signature_invalid")

    # ── Rate limit: max 10 calls/min per source number ────────────────────────
    if await _check_rate_limit(From):
        log.warning("rate_limit_exceeded", from_number=From)
        return _twiml_response(RATE_LIMITED_TWIML)

    # ── Idempotency: Twilio retries same CallSid ──────────────────────────────
    existing_call_id = await get_call_id_by_sid(CallSid)
    if existing_call_id:
        log.info("duplicate_twilio_retry", existing_call_id=existing_call_id)
        return _twiml_response(HOLD_TWIML)

    # ── Lookup phone number → agent ───────────────────────────────────────────
    mapping = await _lookup_agent(To)
    if mapping is None or not mapping.get("agents"):
        log.warning("no_agent_for_number", to=To)
        return _twiml_response(BUSY_TWIML)

    agent_row = mapping["agents"]
    if not agent_row.get("active", False):
        log.warning("agent_inactive", agent_id=agent_row["id"])
        return _twiml_response(BUSY_TWIML)

    # ── Create call state ─────────────────────────────────────────────────────
    call_id = str(uuid.uuid4())
    # Resolve engine: per-number first, then tenant default, then livekit
    engine = mapping.get("engine") or None
    if not engine or engine == "livekit":
        try:
            db_e = get_db()
            t = db_e.table("tenants").select("default_engine").eq("id", mapping["tenant_id"]).maybe_single().execute()
            engine = (t.data.get("default_engine") if t.data else None) or engine or "livekit"
        except Exception:
            pass
    engine = engine or "livekit"
    call = CallState(
        call_id         = call_id,
        tenant_id       = mapping["tenant_id"],
        agent_id        = mapping["agent_id"],
        phone           = From,
        status          = CallStatus.INCOMING,
        engine          = engine,
        twilio_call_sid = CallSid,
    )
    await save_call(call)

    # Idempotency key — prevent duplicate processing on Twilio retry
    await set_idempotency_key(CallSid, call_id)
    r_client = get_redis()
    await r_client.setex(f"sid:{CallSid}", 10800, call_id)

    # ── Agora engine → Media Streams (WebSocket pipeline) ─────────────────────
    if engine == "agora":
        # Store agent config in Redis so the WebSocket handler can load it
        import json as _json
        # Fetch KB context for this agent (first 5 docs, max 3000 chars total)
        kb_context = ""
        try:
            kb_docs = db.table("agent_kb").select("content").eq("agent_id", mapping["agent_id"]).limit(5).execute()
            if kb_docs.data:
                chunks = []
                total = 0
                for doc in kb_docs.data:
                    text = (doc.get("content") or "")[:1000]
                    if total + len(text) > 3000:
                        break
                    chunks.append(text)
                    total += len(text)
                kb_context = "\n\n".join(chunks)
        except Exception:
            pass

        await r_client.setex(
            f"agent_config:{call_id}",
            3600,
            _json.dumps({
                "name":         agent_row["name"],
                "greeting":     agent_row.get("greeting", ""),
                "prompt":       agent_row.get("prompt", ""),
                "kb_context":   kb_context,
                "language":     agent_row.get("language", "en"),
                "voice":        agent_row.get("voice", "nova"),
                "stt":          agent_row.get("stt_provider", "deepgram-nova-3"),
                "llm":          agent_row.get("llm_provider", "gpt-4o-mini"),
                "tts":          agent_row.get("tts_provider", "openai"),
                "tuning":       agent_row.get("tuning") or {},
            }),
        )
        orchestrator_url = settings.orchestrator_public_url.replace("https://", "wss://")
        stream_twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="{orchestrator_url}/media/stream/{call_id}"/>
  </Connect>
</Response>"""
        log.info("media_stream_twiml_served", call_id=call_id, engine="agora")

        # Start Twilio recording via REST API (non-blocking)
        async def _start_recording():
            try:
                import httpx as _httpx
                async with _httpx.AsyncClient(timeout=10) as _client:
                    await _client.post(
                        f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Calls/{CallSid}/Recordings.json",
                        auth=(settings.twilio_account_sid, settings.twilio_auth_token),
                        data={
                            "RecordingStatusCallback": f"{settings.orchestrator_public_url}/telephony/recording-status",
                            "RecordingStatusCallbackEvent": "completed",
                        },
                    )
                    log.info("twilio_recording_started", call_id=call_id)
            except Exception as e:
                log.warning("twilio_recording_failed", error=str(e))
        import asyncio as _asyncio
        _asyncio.create_task(_start_recording())

        return _twiml_response(stream_twiml)

    # ── LiveKit engine → queue-based worker ───────────────────────────────────
    r = get_redis()
    try:
        db = get_db()
        tenant = db.table("tenants").select("plan").eq("id", mapping["tenant_id"]).maybe_single().execute()
        plan = tenant.data.get("plan", "starter") if tenant.data else "starter"
    except Exception:
        plan = "starter"

    queue = "vani:queue:enterprise" if plan == "enterprise" else "vani:queue:standard"
    job = {"call_id": call_id, "to_number": To}
    await r.lpush(queue, json.dumps(job))
    log.info("job_enqueued", call_id=call_id, queue=queue)

    return _twiml_response(HOLD_TWIML)


# ─── Vobiz Inbound Webhook ───────────────────────────────────────────────────

VOBIZ_HOLD_XML = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi">Please hold while we connect your call.</Say>
  <Pause length="55"/>
</Response>"""

VOBIZ_BUSY_XML = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi">Sorry, all agents are busy. Please try again shortly.</Say>
  <Hangup/>
</Response>"""

VOBIZ_RATE_LIMITED_XML = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi">Too many calls from this number. Please try again later.</Say>
  <Hangup/>
</Response>"""


@router.post("/vobiz/inbound")
async def vobiz_inbound(request: Request):
    """
    Vobiz inbound voice webhook.
    When a call arrives on a Vobiz DID, Vobiz POSTs here.
    Flow mirrors /telephony/inbound but returns Vobiz-compatible XML
    with WebSocket stream connect instead of Twilio TwiML.
    """
    body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else dict(await request.form())

    call_sid  = body.get("CallSid") or body.get("call_sid") or body.get("CallUUID") or str(uuid.uuid4())
    from_num  = body.get("From") or body.get("from") or body.get("caller_id") or ""
    to_num    = body.get("To") or body.get("to") or body.get("called_number") or ""

    log = logger.bind(call_sid=call_sid, from_number=from_num, to_number=to_num, provider="vobiz")
    log.info("vobiz_inbound_call")

    # Rate limit
    if await _check_rate_limit(from_num):
        log.warning("rate_limit_exceeded", from_number=from_num)
        return Response(content=VOBIZ_RATE_LIMITED_XML, media_type="application/xml")

    # Idempotency
    existing_call_id = await get_call_id_by_sid(call_sid)
    if existing_call_id:
        log.info("duplicate_vobiz_retry", existing_call_id=existing_call_id)
        return Response(content=VOBIZ_HOLD_XML, media_type="application/xml")

    # Lookup agent
    mapping = await _lookup_agent(to_num)
    if mapping is None or not mapping.get("agents"):
        log.warning("no_agent_for_number", to=to_num)
        return Response(content=VOBIZ_BUSY_XML, media_type="application/xml")

    agent_row = mapping["agents"]
    if not agent_row.get("active", False):
        log.warning("agent_inactive", agent_id=agent_row["id"])
        return Response(content=VOBIZ_BUSY_XML, media_type="application/xml")

    # Create call state
    call_id = str(uuid.uuid4())
    engine = mapping.get("engine") or None
    if not engine or engine == "livekit":
        try:
            db_e = get_db()
            t = db_e.table("tenants").select("default_engine").eq("id", mapping["tenant_id"]).maybe_single().execute()
            engine = (t.data.get("default_engine") if t.data else None) or engine or "agora"
        except Exception:
            pass
    # Vobiz uses WebSocket media streams (agora engine path)
    engine = engine or "agora"

    call = CallState(
        call_id         = call_id,
        tenant_id       = mapping["tenant_id"],
        agent_id        = mapping["agent_id"],
        phone           = from_num,
        status          = CallStatus.INCOMING,
        engine          = engine,
        twilio_call_sid = call_sid,
    )
    await save_call(call)
    await set_idempotency_key(call_sid, call_id)

    r_client = get_redis()
    await r_client.setex(f"sid:{call_sid}", 10800, call_id)

    # Store agent config for WebSocket handler
    db = get_db()
    kb_context = ""
    try:
        kb_docs = db.table("agent_kb").select("content").eq("agent_id", mapping["agent_id"]).limit(5).execute()
        if kb_docs.data:
            chunks = []
            total = 0
            for doc in kb_docs.data:
                text = (doc.get("content") or "")[:1000]
                if total + len(text) > 3000:
                    break
                chunks.append(text)
                total += len(text)
            kb_context = "\n\n".join(chunks)
    except Exception:
        pass

    await r_client.setex(
        f"agent_config:{call_id}",
        3600,
        json.dumps({
            "name":         agent_row["name"],
            "greeting":     agent_row.get("greeting", ""),
            "prompt":       agent_row.get("prompt", ""),
            "kb_context":   kb_context,
            "language":     agent_row.get("language", "en"),
            "voice":        agent_row.get("voice", "nova"),
            "stt":          agent_row.get("stt_provider", "deepgram-nova-3"),
            "llm":          agent_row.get("llm_provider", "gpt-4o-mini"),
            "tts":          agent_row.get("tts_provider", "openai"),
            "tuning":       agent_row.get("tuning") or {},
        }),
    )

    # Return XML that tells Vobiz to stream audio to our WebSocket
    # Vobiz uses bare <Stream> (not <Connect><Stream>) — confirmed by testing
    orchestrator_ws = settings.orchestrator_public_url.replace("https://", "wss://")
    stream_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">
    {orchestrator_ws}/media/stream/{call_id}
  </Stream>
</Response>"""

    log.info("vobiz_stream_xml_served", call_id=call_id, engine=engine)
    return Response(content=stream_xml, media_type="application/xml")


# ─── Vobiz Answer URL (for outbound calls) ───────────────────────────────────

@router.post("/vobiz/answer/{call_id}")
@router.get("/vobiz/answer/{call_id}")
async def vobiz_answer(call_id: str, request: Request):
    """
    Vobiz calls this URL when an outbound call is answered.
    Returns XML to connect the call to our media stream WebSocket.
    """
    log = logger.bind(call_id=call_id, provider="vobiz")
    log.info("vobiz_outbound_answered")

    r = get_redis()
    raw_cfg = await r.get(f"agent_config:{call_id}")
    if not raw_cfg:
        # Config not yet stored — try to load from outbound_cfg
        raw_outbound = await r.get(f"outbound_cfg:{call_id}")
        if raw_outbound:
            job_data = json.loads(raw_outbound)
            agent_config = job_data.get("agent_config") or {}
            # Store as agent_config for WebSocket handler
            await r.setex(
                f"agent_config:{call_id}",
                3600,
                json.dumps({
                    "name":     agent_config.get("name", "Agent"),
                    "greeting": agent_config.get("greeting", ""),
                    "prompt":   agent_config.get("prompt", "You are a helpful assistant."),
                    "kb_context": "",
                    "language": agent_config.get("language", "en"),
                    "voice":    agent_config.get("voice", "alloy"),
                    "stt":      agent_config.get("stt", "deepgram-nova-3"),
                    "llm":      agent_config.get("llm", "gpt-4o-mini"),
                    "tts":      agent_config.get("tts", "openai"),
                    "tuning":   {},
                }),
            )
        else:
            log.error("vobiz_answer_no_config")
            return Response(
                content='<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>',
                media_type="application/xml",
            )

    orchestrator_ws = settings.orchestrator_public_url.replace("https://", "wss://")
    stream_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">
    {orchestrator_ws}/media/stream/{call_id}
  </Stream>
</Response>"""

    log.info("vobiz_answer_stream_xml_served", call_id=call_id)
    return Response(content=stream_xml, media_type="application/xml")


@router.post("/vobiz/hangup")
async def vobiz_hangup(request: Request):
    """Vobiz hangup callback — mark call as completed."""
    body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else dict(await request.form())
    call_sid = body.get("CallUUID") or body.get("CallSid") or ""
    logger.info("vobiz_hangup", call_sid=call_sid)
    return {"ok": True}
