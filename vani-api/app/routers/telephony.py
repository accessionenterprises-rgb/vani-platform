"""
Telephony TwiML — returns TwiML to connect Twilio calls to LiveKit SIP.

POST /telephony/twiml — Twilio voice webhook, returns <Dial><Sip> TwiML
"""
import os

from fastapi import APIRouter, Form, Request
from fastapi.responses import Response

router = APIRouter(prefix="/telephony", tags=["telephony"])

SIP_HOST = os.getenv("LIVEKIT_SIP_HOST", "vaani-voice-s42m8zzi.sip.livekit.cloud")
SIP_USER = os.getenv("LIVEKIT_SIP_USER", "vanisip")
SIP_PASS = os.getenv("LIVEKIT_SIP_PASS", "Vani2026Sip!")


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
  <Dial timeout="30">
    <Sip username="{SIP_USER}" password="{SIP_PASS}">sip:{sip_number}@{SIP_HOST};transport=tcp</Sip>
  </Dial>
</Response>"""

    return Response(content=twiml, media_type="application/xml")
