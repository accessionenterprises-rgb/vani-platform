"""
Agora ↔ Twilio SIP bridge TwiML.

When a call is routed to the Agora engine:
1. Worker creates Agora agent in a channel via /join
2. Worker patches the live Twilio call to redirect here
3. This endpoint returns TwiML that streams audio to/from the Agora channel

Agora SIP endpoint: sip:{channel}@{appid}.agora.io
"""
import os

import structlog
from fastapi import APIRouter
from fastapi.responses import Response

from config import settings

logger = structlog.get_logger()
router = APIRouter(prefix="/telephony/agora", tags=["agora-telephony"])


@router.get("/connect/{call_id}/{channel}")
@router.post("/connect/{call_id}/{channel}")
async def agora_connect_twiml(call_id: str, channel: str):
    """
    Return TwiML that connects the Twilio call to an Agora RTC channel via SIP.

    Agora's SIP gateway: sip:<channel>@<appid>.agora.io
    The Agora agent (created via /join) is already in this channel waiting.
    """
    app_id = settings.agora_app_id
    if not app_id:
        logger.error("agora_app_id_not_configured")
        return Response(
            content='<?xml version="1.0"?><Response><Say>Engine not configured.</Say><Hangup/></Response>',
            media_type="application/xml",
        )

    # Agora SBC SIP URI — India/Asia-Pacific region
    # Channel name is the SIP user part; Agora SBC routes to the matching RTC channel
    sip_uri = f"sip:{channel}@sbc-ap-south.viblinx.com:5060"

    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="30">
    <Sip>{sip_uri}</Sip>
  </Dial>
</Response>"""

    logger.info("agora_twiml_served", call_id=call_id, channel=channel, sip_uri=sip_uri)
    return Response(content=twiml, media_type="application/xml")
