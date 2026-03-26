"""
LiveKit ↔ Twilio SIP bridge TwiML.

When a call is routed to the LiveKit engine:
1. Worker creates LiveKit room + dispatches agent
2. Worker patches the live Twilio call to redirect here
3. This endpoint returns TwiML that dials into the LiveKit SIP trunk
"""
import structlog
from fastapi import APIRouter
from fastapi.responses import Response

from config import settings

logger = structlog.get_logger()
router = APIRouter(prefix="/telephony/livekit", tags=["livekit-telephony"])


@router.get("/connect/{call_id}/{room_name}")
@router.post("/connect/{call_id}/{room_name}")
async def livekit_connect_twiml(call_id: str, room_name: str):
    """
    Return TwiML that connects the Twilio call to a LiveKit room via SIP.

    LiveKit SIP URI: sip:<room>@<livekit-sip-host>
    The vani-agent is already dispatched and waiting in the room.
    """
    # LiveKit SIP trunk host — separate from project URL
    import os
    sip_host = os.getenv("LIVEKIT_SIP_HOST", "1h5xw3nwkcn.sip.livekit.cloud")
    sip_uri = f"sip:{room_name}@{sip_host}"

    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="30">
    <Sip>{sip_uri}</Sip>
  </Dial>
</Response>"""

    logger.info("livekit_twiml_served", call_id=call_id, room=room_name, sip_uri=sip_uri)
    return Response(content=twiml, media_type="application/xml")
