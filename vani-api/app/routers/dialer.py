"""
Browser dialer endpoints.

GET  /dialer/token  — generate Twilio Access Token for the Voice JS SDK
POST /dialer/voice  — PUBLIC TwiML callback (Twilio calls this when browser dials)
"""
from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import Response

from app.config import settings
from app.db import get_db
from app.middleware.auth import get_tenant_id

router = APIRouter(prefix="/dialer", tags=["dialer"])


@router.get("/token")
async def get_dialer_token(tenant_id: str = Depends(get_tenant_id)):
    """Return a Twilio Access Token scoped to the Voice JS SDK."""
    if not settings.twilio_account_sid or not settings.twilio_api_key:
        raise HTTPException(status_code=503, detail="Dialer not configured")

    try:
        from twilio.jwt.access_token import AccessToken
        from twilio.jwt.access_token.grants import VoiceGrant
    except ImportError:
        raise HTTPException(status_code=503, detail="twilio package not installed")

    token = AccessToken(
        settings.twilio_account_sid,
        settings.twilio_api_key,
        settings.twilio_api_secret,
        identity=tenant_id,
        ttl=3600,
    )
    token.add_grant(VoiceGrant(
        outgoing_application_sid=settings.twilio_twiml_app_sid,
        incoming_allow=False,
    ))
    return {"token": token.to_jwt()}


@router.post("/voice")
async def dialer_voice(
    To: str = Form(...),
    From: str = Form(default=""),
):
    """
    Twilio calls this URL when the browser client places a call.
    Returns TwiML that dials the destination with the chosen caller ID.
    Public — no auth (Twilio calls this server-side).
    """
    caller_id = From or settings.twilio_caller_id
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="{caller_id}" timeout="30">
    <Number>{To}</Number>
  </Dial>
</Response>"""
    return Response(content=twiml, media_type="application/xml")
