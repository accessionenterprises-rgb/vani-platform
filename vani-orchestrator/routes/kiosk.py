"""
POST /kiosk/session — create a kiosk LiveKit session for a given agent.

Flow:
  1. Validate agent_id belongs to tenant (via API key header)
  2. Create LiveKit room
  3. Dispatch vani-agent with agent config as metadata
  4. Return room_name + caller token for the kiosk browser to join
"""
import json
import uuid

import httpx
import structlog
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from config import settings
from services.livekit_manager import create_room, dispatch_agent, generate_caller_token

logger = structlog.get_logger()

router = APIRouter(prefix="/kiosk", tags=["kiosk"])

VAANI_API_URL = f"http://localhost:{settings.port - 1 if settings.port > 8001 else 8000}"  # vani-api


class KioskSessionRequest(BaseModel):
    agent_id:   str
    visitor_id: str | None  = None   # optional — for analytics
    products:   list | None = None   # Fairshift tenant product catalog (injected by Fairshift API)
    metadata:   dict | None = None   # extra context: tenant_id, preferred_language, etc.


class KioskSessionResponse(BaseModel):
    room_name: str
    token: str
    livekit_url: str
    call_id: str


async def _fetch_agent(agent_id: str, api_key: str) -> dict:
    """Fetch agent config from vani-api using the tenant's API key."""
    vani_api = settings.__dict__.get("vani_api_url", "http://localhost:8000")
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{vani_api}/agents/{agent_id}",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if resp.status_code == 404:
                raise HTTPException(status_code=404, detail="Agent not found")
            if resp.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid API key")
            resp.raise_for_status()
            return resp.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.error("agent_fetch_failed", agent_id=agent_id, error=str(e))
        raise HTTPException(status_code=502, detail="Could not fetch agent config")


@router.post("/session", response_model=KioskSessionResponse)
async def create_kiosk_session(
    body: KioskSessionRequest,
    x_api_key: str = Header(..., alias="X-API-Key"),
):
    log = logger.bind(agent_id=body.agent_id)
    log.info("kiosk_session_request")

    agent = await _fetch_agent(body.agent_id, x_api_key)

    if not agent.get("active", False):
        raise HTTPException(status_code=400, detail="Agent is not active")

    call_id   = str(uuid.uuid4())
    room_name = await create_room()

    agent_payload = {
        "call_id":      call_id,
        "agent_id":     body.agent_id,
        "tenant_id":    agent["tenant_id"],
        "direction":    "kiosk",
        "visitor_id":   body.visitor_id or "",
        "products":     body.products or [],        # tenant product catalog from Fairshift
        "metadata":     body.metadata or {},        # preferred_language, etc.
        "agent_config": {
            "prompt":    agent["prompt"],
            "greeting":  agent["greeting"],
            "language":  (body.metadata or {}).get("preferred_language") or agent["language"],
            "voice":     agent["voice"],
            "llm":       agent["llm_provider"],
            "stt":       agent["stt_provider"],
            "tts":       agent["tts_provider"],
        },
    }

    await dispatch_agent(room_name, agent_payload)

    token = generate_caller_token(room_name, identity=f"kiosk-{call_id[:8]}")

    log.info("kiosk_session_created", call_id=call_id, room=room_name)

    return KioskSessionResponse(
        room_name=room_name,
        token=token,
        livekit_url=settings.livekit_url,
        call_id=call_id,
    )
