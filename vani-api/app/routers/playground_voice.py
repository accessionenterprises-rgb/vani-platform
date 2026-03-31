"""
Playground voice call — browser-based WebRTC voice testing.

POST /playground/voice/start
  body: { agent_id }
  Returns: { room_name, token, livekit_url }

The browser joins the LiveKit room with the returned token.
The agent is dispatched to the same room automatically.
"""
import os

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.middleware.auth import get_tenant_id

logger = structlog.get_logger()

router = APIRouter(prefix="/playground", tags=["Playground"])

LIVEKIT_URL = os.getenv("LIVEKIT_URL", "wss://vaani-production-ph9tiyzv.livekit.cloud")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")


class VoiceStartRequest(BaseModel):
    agent_id: str


@router.post("/voice/start")
async def start_voice_session(
    body: VoiceStartRequest,
    tenant_id: str = Depends(get_tenant_id),
):
    """Create a LiveKit room, dispatch agent, return token for browser to join."""
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        raise HTTPException(status_code=500, detail="LiveKit not configured")

    db = get_db()
    agent = (
        db.table("agents").select("*")
        .eq("id", body.agent_id)
        .eq("tenant_id", tenant_id)
        .maybe_single().execute()
    )
    if not agent.data:
        raise HTTPException(status_code=404, detail="Agent not found")

    try:
        from livekit import api as lk_api
        import json

        lk_api_url = LIVEKIT_URL.replace("wss://", "https://").replace("ws://", "http://")
        lk = lk_api.LiveKitAPI(lk_api_url, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)

        # Create room
        import secrets
        room_name = f"playground-{secrets.token_hex(6)}"
        await lk.room.create_room(lk_api.CreateRoomRequest(name=room_name, empty_timeout=300))

        # Dispatch agent
        await lk.agent_dispatch.create_dispatch(
            lk_api.CreateAgentDispatchRequest(
                agent_name="vani-agent",
                room=room_name,
                metadata=json.dumps({
                    "agent_id": body.agent_id,
                    "tenant_id": tenant_id,
                    "source": "playground",
                }),
            )
        )

        # Generate token for browser
        token = lk_api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        token.with_identity(f"user-{tenant_id[:8]}")
        token.with_name("Browser Test")
        token.with_grants(lk_api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_subscribe=True,
        ))

        await lk.aclose()

        return {
            "room_name": room_name,
            "token": token.to_jwt(),
            "livekit_url": LIVEKIT_URL.replace("wss://", "wss://"),
        }

    except Exception as e:
        logger.error("playground_voice_start_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to start voice session: {e}")


@router.post("/keepalive")
async def keepalive_ping():
    """Create a short-lived room to keep the agent warm. Called by cron every 4 min."""
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        return {"ok": False, "reason": "not configured"}
    try:
        from livekit import api as lk_api
        import json, secrets

        lk_api_url = LIVEKIT_URL.replace("wss://", "https://").replace("ws://", "http://")
        lk = lk_api.LiveKitAPI(lk_api_url, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        room_name = f"keepalive-{secrets.token_hex(4)}"
        await lk.room.create_room(lk_api.CreateRoomRequest(name=room_name, empty_timeout=10))
        await lk.agent_dispatch.create_dispatch(
            lk_api.CreateAgentDispatchRequest(
                agent_name="vani-agent",
                room=room_name,
                metadata=json.dumps({"source": "keepalive"}),
            )
        )
        await lk.aclose()
        return {"ok": True, "room": room_name}
    except Exception as e:
        logger.error("keepalive_failed", error=str(e))
        return {"ok": False, "reason": str(e)}
