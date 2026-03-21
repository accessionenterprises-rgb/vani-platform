"""
Warm SIP transfer — moves active call to a human agent.

Flow:
  1. Engine fires ESCALATION event → internal.py calls POST /internal/transfer/{call_id}
  2. transfer.py looks up Twilio CallSid from Redis call state
  3. Patches the Twilio call TwiML to dial the transfer number with a whisper URL
  4. Whisper TwiML plays a briefing message to the human agent before connecting

Endpoints (internal — not auth-gated):
  POST /internal/transfer/{call_id}   { transfer_number, whisper_text?, agent_name? }
  GET  /telephony/transfer/whisper/{call_id}   → TwiML played to human agent
"""
import os
import urllib.parse

import httpx
import structlog
from fastapi import APIRouter, Request
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional

from redis_client import get_redis
from services.state_manager import load_call

logger = structlog.get_logger()

router = APIRouter(tags=["transfer"])

ORCHESTRATOR_URL = os.getenv("ORCHESTRATOR_PUBLIC_URL", "https://orchestrator.vani.live")


class TransferRequest(BaseModel):
    transfer_number: str
    whisper_text: Optional[str] = None
    agent_name: Optional[str] = None


@router.post("/internal/transfer/{call_id}")
async def initiate_transfer(call_id: str, body: TransferRequest):
    log = logger.bind(call_id=call_id, to=body.transfer_number)

    # Load call state from Redis
    call = await load_call(call_id)
    if not call:
        log.warning("transfer_call_not_found")
        return {"ok": False, "detail": "Call not found"}

    twilio_call_sid = getattr(call, "twilio_call_sid", None)
    if not twilio_call_sid:
        log.warning("transfer_no_call_sid")
        return {"ok": False, "detail": "Twilio CallSid not available for this call"}

    # Store whisper text in Redis so the whisper endpoint can serve it
    r = get_redis()
    whisper_text = (body.whisper_text or
                    f"You are being connected to a caller. The AI agent {body.agent_name or 'Vaani'} "
                    f"has transferred this call to you. Please assist the customer.")
    await r.setex(f"whisper:{call_id}", 300, whisper_text)

    # Twilio credentials
    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    auth_token  = os.getenv("TWILIO_AUTH_TOKEN", "")

    if not account_sid or not auth_token:
        log.error("transfer_twilio_creds_missing")
        return {"ok": False, "detail": "Twilio credentials not configured"}

    whisper_url = f"{ORCHESTRATOR_URL}/telephony/transfer/whisper/{call_id}"
    twiml = (
        f'<?xml version="1.0" encoding="UTF-8"?>'
        f'<Response><Dial>'
        f'<Number url="{whisper_url}">{body.transfer_number}</Number>'
        f'</Dial></Response>'
    )

    # Patch the live Twilio call to switch TwiML
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Calls/{twilio_call_sid}.json",
                auth=(account_sid, auth_token),
                data={"Twiml": twiml},
            )
        if resp.status_code in (200, 204):
            log.info("transfer_initiated", call_sid=twilio_call_sid, to=body.transfer_number)
            return {"ok": True, "call_sid": twilio_call_sid, "transfer_number": body.transfer_number}
        else:
            log.error("transfer_twilio_error", status=resp.status_code, body=resp.text[:200])
            return {"ok": False, "detail": f"Twilio error: {resp.status_code}"}
    except Exception as exc:
        log.error("transfer_exception", error=str(exc))
        return {"ok": False, "detail": str(exc)}


@router.get("/telephony/transfer/whisper/{call_id}")
async def whisper_twiml(call_id: str):
    """
    Twilio calls this URL on the HUMAN AGENT's leg before connecting the caller.
    Plays a brief message so the human agent knows what's happening.
    """
    r = get_redis()
    whisper_text = await r.get(f"whisper:{call_id}")
    if not whisper_text:
        whisper_text = "You are being connected to a caller from the AI system. Please hold."

    # Escape XML entities
    safe_text = (whisper_text
                 .replace("&", "&amp;")
                 .replace("<", "&lt;")
                 .replace(">", "&gt;")
                 .replace('"', "&quot;"))

    twiml = (
        f'<?xml version="1.0" encoding="UTF-8"?>'
        f'<Response>'
        f'<Say voice="alice">{safe_text}</Say>'
        f'</Response>'
    )
    return Response(content=twiml, media_type="application/xml")
