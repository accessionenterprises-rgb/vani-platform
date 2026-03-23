"""
TTS voice preview — generates a short audio sample for voice selection.

GET /tts/preview?voice=openai-nova
  → audio/mpeg stream
"""
import os

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from app.middleware.auth import get_tenant_id

logger = structlog.get_logger()

router = APIRouter(prefix="/tts", tags=["tts"])

PREVIEW_TEXT = "Hi there! Thanks for calling. I'm your AI assistant and I'm here to help you today. How can I assist you?"

# OpenAI voice IDs map to our provider IDs
OPENAI_VOICES = {
    "openai-nova": "nova",
    "openai-shimmer": "shimmer",
    "openai-alloy": "alloy",
    "openai-echo": "echo",
    "openai-fable": "fable",
    "openai-onyx": "onyx",
}


@router.get("/preview")
async def preview_voice(voice: str, tenant_id: str = Depends(get_tenant_id)):
    """Generate a short TTS audio sample for the given voice."""

    # Only OpenAI voices supported for preview currently
    openai_voice = OPENAI_VOICES.get(voice)
    if not openai_voice:
        raise HTTPException(status_code=400, detail=f"Preview not available for '{voice}'. Only OpenAI voices supported.")

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.openai.com/v1/audio/speech",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "tts-1",
                    "input": PREVIEW_TEXT,
                    "voice": openai_voice,
                    "response_format": "mp3",
                },
            )
        resp.raise_for_status()
        return Response(
            content=resp.content,
            media_type="audio/mpeg",
            headers={"Cache-Control": "public, max-age=86400"},  # Cache for 24h
        )
    except Exception as exc:
        logger.error("tts_preview_failed", voice=voice, error=str(exc))
        raise HTTPException(status_code=502, detail="TTS preview failed")
