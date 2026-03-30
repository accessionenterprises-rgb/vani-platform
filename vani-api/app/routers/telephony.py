"""
Telephony TwiML — returns TwiML to connect Twilio calls to LiveKit SIP.

POST /telephony/twiml — Twilio voice webhook, returns <Dial><Sip> TwiML
"""
import os

from fastapi import APIRouter, Form, Request
from fastapi.responses import Response

router = APIRouter(prefix="/telephony", tags=["telephony"])

SIP_HOST = os.getenv("LIVEKIT_SIP_HOST", "1kf73cgub7v.sip.livekit.cloud")
SIP_HOST_SELF = os.getenv("LIVEKIT_SIP_HOST_SELF", "35.244.15.25")


@router.post("/twiml")
async def twiml_webhook(
    request: Request,
    To: str = Form(default=""),
    From: str = Form(default=""),
    CallSid: str = Form(default=""),
):
    """Return TwiML that dials LiveKit SIP endpoint with auth."""
    to_number = To if To else "+19209209967"
    # Strip the + for SIP URI — use raw digits only
    sip_number = to_number.lstrip("+")

    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="120">
    <Sip>sip:{sip_number}@{SIP_HOST};transport=tcp</Sip>
  </Dial>
</Response>"""

    return Response(content=twiml, media_type="application/xml")


@router.post("/twiml-self")
async def twiml_self_hosted(
    request: Request,
    To: str = Form(default=""),
    From: str = Form(default=""),
    CallSid: str = Form(default=""),
):
    """Return TwiML that dials self-hosted LiveKit SIP endpoint."""
    to_number = To if To else "+15015019977"
    sip_number = to_number.lstrip("+")

    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="120">
    <Sip>sip:{sip_number}@{SIP_HOST_SELF};transport=tcp</Sip>
  </Dial>
</Response>"""

    return Response(content=twiml, media_type="application/xml")
