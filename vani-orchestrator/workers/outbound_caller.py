"""
Outbound caller worker — picks outbound jobs from Redis queue and places calls.

Flow:
  1. BLPOP vani:queue:outbound:enterprise | vani:queue:outbound
  2. Check cancel flag
  3. Check DNC (Do-Not-Call) list
  4. Determine telephony provider from tenant config
  5. Initiate call via Twilio REST API (or Exotel) with MachineDetection=Enable
  6. When Twilio answers → POST /telephony/outbound/answered → engine starts
  7. AMD voicemail: Twilio sends AnsweredBy=machine_* → hang up + schedule retry
"""
import asyncio
import json
import os

import httpx
import structlog

from config import settings
from db import get_db
from redis_client import get_redis
from services import livekit_manager
from services.state_manager import save_call, update_status
from models.call_state import CallState, CallStatus

logger = structlog.get_logger()

OUTBOUND_QUEUES = ["vani:queue:outbound:enterprise", "vani:queue:outbound"]
CANCEL_TTL = 300


async def _check_cancelled(call_id: str) -> bool:
    r = get_redis()
    return bool(await r.exists(f"cancel:{call_id}"))


async def _check_dnc(tenant_id: str, phone: str) -> bool:
    """Return True if phone is on this tenant's DNC list."""
    db = get_db()
    result = (
        db.table("dnc_numbers")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("phone", phone)
        .maybe_single()
        .execute()
    )
    return result.data is not None


async def _initiate_twilio_call(to: str, from_number: str, call_id: str, twilio_config: dict) -> str | None:
    """
    Place outbound call via Twilio REST API.
    MachineDetection=Enable: Twilio detects AMD before calling our URL.
    Returns the Twilio CallSid on success.
    """
    account_sid = twilio_config.get("twilio_account_sid") or os.getenv("TWILIO_ACCOUNT_SID", "")
    auth_token  = twilio_config.get("twilio_auth_token")  or os.getenv("TWILIO_AUTH_TOKEN", "")

    if not account_sid or not auth_token:
        logger.error("twilio_credentials_missing", call_id=call_id)
        return None

    orchestrator_url = os.getenv("ORCHESTRATOR_PUBLIC_URL", "https://orchestrator.vani.live")
    twiml_url   = f"{orchestrator_url}/telephony/outbound/answered/{call_id}"
    status_url  = f"{orchestrator_url}/telephony/outbound/status/{call_id}"

    recording_cb = f"{orchestrator_url}/telephony/recording-status"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Calls.json",
                auth=(account_sid, auth_token),
                data={
                    "To":   to,
                    "From": from_number,
                    "Url":  twiml_url,
                    "StatusCallback": status_url,
                    "StatusCallbackEvent": ["initiated", "ringing", "answered", "completed"],
                    "StatusCallbackMethod": "POST",
                    "Timeout": "30",
                    # AMD: Twilio waits for detection before POSTing to Url
                    # AnsweredBy=human|machine_start|machine_end_beep|machine_end_other
                    "MachineDetection": "Enable",
                    "AsyncAmd": "false",   # synchronous — Twilio waits before calling Url
                    # Recording
                    "Record": "true",
                    "RecordingStatusCallback": recording_cb,
                    "RecordingStatusCallbackMethod": "POST",
                }
            )
        if resp.status_code == 201:
            return resp.json().get("sid")
        else:
            logger.error("twilio_call_failed", status=resp.status_code, body=resp.text[:200])
            return None
    except Exception as e:
        logger.error("twilio_call_exception", error=str(e))
        return None


async def _initiate_vobiz_call(to: str, from_number: str, call_id: str, vobiz_config: dict) -> str | None:
    """
    Place outbound call via Vobiz REST API.
    Returns the Vobiz CallUUID on success.
    """
    auth_id    = vobiz_config.get("vobiz_auth_id")    or os.getenv("VOBIZ_AUTH_ID", "")
    auth_token = vobiz_config.get("vobiz_auth_token")  or os.getenv("VOBIZ_AUTH_TOKEN", "")

    if not auth_id or not auth_token:
        logger.error("vobiz_credentials_missing", call_id=call_id)
        return None

    orchestrator_url = os.getenv("ORCHESTRATOR_PUBLIC_URL", "https://orchestrator.vani.live")
    answer_url = f"{orchestrator_url}/telephony/vobiz/answer/{call_id}"
    status_url = f"{orchestrator_url}/telephony/outbound/status/{call_id}"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"https://api.vobiz.ai/api/v1/Account/{auth_id}/Call/",
                headers={
                    "X-Auth-ID": auth_id,
                    "X-Auth-Token": auth_token,
                },
                json={
                    "from": from_number,
                    "to": to,
                    "answer_url": answer_url,
                    "hangup_url": status_url,
                },
            )
        if resp.status_code in (200, 201):
            return resp.json().get("call_uuid") or resp.json().get("CallUUID") or resp.json().get("sid")
        else:
            logger.error("vobiz_call_failed", status=resp.status_code, body=resp.text[:200])
            return None
    except Exception as e:
        logger.error("vobiz_call_exception", error=str(e))
        return None


async def _initiate_exotel_call(to: str, from_number: str, call_id: str, exotel_config: dict) -> str | None:
    """Place outbound call via Exotel REST API."""
    api_key   = exotel_config.get("exotel_api_key")   or os.getenv("EXOTEL_API_KEY", "")
    api_token = exotel_config.get("exotel_api_token")  or os.getenv("EXOTEL_API_TOKEN", "")
    sid       = exotel_config.get("exotel_sid")        or os.getenv("EXOTEL_SID", "")

    if not (api_key and api_token and sid):
        return None

    orchestrator_url = os.getenv("ORCHESTRATOR_PUBLIC_URL", "https://orchestrator.vani.live")
    action_url = f"{orchestrator_url}/telephony/outbound/answered/{call_id}"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"https://api.exotel.com/v1/Accounts/{sid}/Calls/connect",
                auth=(api_key, api_token),
                data={
                    "From":           to,
                    "To":             from_number,
                    "CallerId":       from_number,
                    "Url":            action_url,
                    "StatusCallback": f"{orchestrator_url}/telephony/outbound/status/{call_id}",
                }
            )
        if resp.status_code in (200, 201):
            return resp.json().get("Call", {}).get("Sid")
        return None
    except Exception as e:
        logger.error("exotel_outbound_failed", error=str(e))
        return None


async def _process_outbound_job(job: dict) -> None:
    call_id    = job["call_id"]
    to         = job["to"]
    from_num   = job["from_number"]
    tenant_id  = job.get("tenant_id", "")
    telephony_config = job.get("telephony_config", {})
    log = logger.bind(call_id=call_id, to=to)

    db = get_db()

    # 1. Cancel check
    if await _check_cancelled(call_id):
        log.info("outbound_cancelled_before_dial")
        db.table("calls").update({"status": "cancelled"}).eq("id", call_id).execute()
        return

    # 2. DNC check
    if tenant_id and await _check_dnc(tenant_id, to):
        log.info("outbound_dnc_blocked", to=to)
        db.table("calls").update({
            "status": "failed",
            "metadata": {"error": "dnc_blocked"},
        }).eq("id", call_id).execute()
        # Mark contact as DNC if this is a campaign call
        campaign_contact_id = job.get("campaign_contact_id")
        if campaign_contact_id:
            db.table("campaign_contacts").update({
                "status": "dnc",
                "last_outcome": "dnc_blocked",
            }).eq("id", campaign_contact_id).execute()
        return

    db.table("calls").update({"status": "routing"}).eq("id", call_id).execute()

    # 3. Determine provider and dial
    #    Check explicit provider flag first (set by API when number is vobiz),
    #    then fall back to credential detection.
    explicit_provider = telephony_config.get("provider") or job.get("provider")
    has_vobiz  = explicit_provider == "vobiz" or bool(telephony_config.get("vobiz_auth_id") or os.getenv("VOBIZ_AUTH_ID"))
    has_twilio = bool(telephony_config.get("twilio_account_sid") or os.getenv("TWILIO_ACCOUNT_SID"))
    has_exotel = bool(telephony_config.get("exotel_api_key")     or os.getenv("EXOTEL_API_KEY"))

    call_sid = None
    if explicit_provider == "vobiz" or (has_vobiz and not has_twilio):
        call_sid = await _initiate_vobiz_call(to, from_num, call_id, telephony_config)
    elif has_twilio:
        call_sid = await _initiate_twilio_call(to, from_num, call_id, telephony_config)
    elif has_exotel:
        call_sid = await _initiate_exotel_call(to, from_num, call_id, telephony_config)
    else:
        log.error("no_telephony_provider_configured")
        db.table("calls").update({"status": "failed"}).eq("id", call_id).execute()
        return

    if not call_sid:
        db.table("calls").update({
            "status": "failed",
            "metadata": {"error": "telephony_initiation_failed"},
        }).eq("id", call_id).execute()
        return

    # 4. Save full job data to Redis for TwiML callback to use
    r = get_redis()
    await r.setex(f"outbound_sid:{call_sid}", 3600, call_id)
    await r.setex(f"outbound_cfg:{call_id}", 3600, json.dumps({
        "agent_config":         job.get("agent_config", {}),
        "campaign_id":          job.get("campaign_id"),
        "campaign_contact_id":  job.get("campaign_contact_id"),
        "tenant_id":            tenant_id,
        "retry_config":         job.get("retry_config", {}),
    }))

    db.table("calls").update({"status": "connecting"}).eq("id", call_id).execute()
    log.info("outbound_call_initiated", call_sid=call_sid)


async def outbound_caller(worker_id: int = 0) -> None:
    """Main outbound worker loop."""
    r = get_redis()
    log = logger.bind(worker_id=f"outbound-{worker_id}")
    log.info("outbound_caller_started")

    while True:
        await r.setex(f"outbound_worker:{worker_id}:heartbeat", 10, "alive")
        try:
            result = await r.blpop(OUTBOUND_QUEUES, timeout=5)
            if result is None:
                continue
            _, raw = result
            job = json.loads(raw)
            log.info("outbound_job_received", call_id=job.get("call_id"))
            await _process_outbound_job(job)
        except Exception as e:
            log.error("outbound_worker_error", error=str(e))
            await asyncio.sleep(1)
