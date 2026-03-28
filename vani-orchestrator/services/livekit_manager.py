"""LiveKit room management — create rooms, dispatch agents, generate tokens."""
import json
import uuid

from livekit import api

from config import settings


def _get_api() -> api.LiveKitAPI:
    return api.LiveKitAPI(
        url=settings.livekit_url,
        api_key=settings.livekit_api_key,
        api_secret=settings.livekit_api_secret,
    )


async def create_room(room_name: str | None = None) -> str:
    """Create a LiveKit room and return its name."""
    name = room_name or f"call-{uuid.uuid4().hex[:12]}"
    lk = _get_api()
    try:
        await lk.room.create_room(api.CreateRoomRequest(name=name))
    finally:
        await lk.aclose()
    return name


async def dispatch_agent(room_name: str, agent_payload: dict) -> None:
    """Dispatch vani-agent into a room with metadata."""
    lk = _get_api()
    try:
        await lk.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(
                agent_name="vani-agent",
                room=room_name,
                metadata=json.dumps(agent_payload),
            )
        )
    finally:
        await lk.aclose()


def generate_caller_token(room_name: str, identity: str = "caller") -> str:
    """Generate a LiveKit access token for a caller to join a room."""
    token = api.AccessToken(
        api_key=settings.livekit_api_key,
        api_secret=settings.livekit_api_secret,
    )
    token.with_identity(identity)
    token.with_grants(api.VideoGrants(room_join=True, room=room_name))
    return token.to_jwt()
