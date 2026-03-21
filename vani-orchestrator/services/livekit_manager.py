"""LiveKit room creation, token generation, agent dispatch.

Room creation + dispatch: lk CLI subprocess (avoids macOS SSL cert issue).
Token generation: livekit AccessToken (local JWT signing — no network call).
"""
import asyncio
import json
import random
import shutil
import string

from livekit import api as lk_api

from config import settings

LK_BIN = shutil.which("lk") or str(__import__("pathlib").Path.home() / "bin/lk")

_LK_BASE = [
    LK_BIN,
    "--url", settings.livekit_url,
    "--api-key", settings.livekit_api_key,
    "--api-secret", settings.livekit_api_secret,
]


def _make_room_name() -> str:
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f"vani-{suffix}"


async def _run(cmd: list[str]) -> str:
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(stderr.decode().strip() or f"lk exited {proc.returncode}")
    return stdout.decode().strip()


async def create_room() -> str:
    """Create a LiveKit room and return its name."""
    room_name = _make_room_name()
    await _run([*_LK_BASE, "room", "create", room_name])
    return room_name


def generate_caller_token(room_name: str, identity: str = "caller") -> str:
    """Generate a LiveKit JWT for the caller (local signing — no network)."""
    token = lk_api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
    token.with_identity(identity).with_name("Caller")
    token.with_grants(lk_api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
    ))
    return token.to_jwt()


async def dispatch_agent(room_name: str, agent_payload: dict) -> None:
    """Dispatch vani-agent to room with full config as metadata."""
    metadata = json.dumps(agent_payload)
    await _run([
        *_LK_BASE, "dispatch", "create",
        "--agent-name", settings.livekit_agent_name,
        "--room", room_name,
        "--metadata", metadata,
    ])
