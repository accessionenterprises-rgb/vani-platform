"""
TTS voice preview — generates a short audio sample for voice selection.

GET /tts/preview?voice=openai-nova
GET /tts/preview?voice=sarvam-meera
  → audio/mpeg or audio/wav stream
"""
import base64
import os

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from app.middleware.auth import get_tenant_id

logger = structlog.get_logger()

router = APIRouter(prefix="/tts", tags=["tts"])

PREVIEW_TEXT_EN = "Hi there! Thanks for calling. I'm your AI assistant and I'm here to help you today. How can I assist you?"
PREVIEW_TEXT_HI = "नमस्ते! कॉल करने के लिए धन्यवाद। मैं आपकी AI असिस्टेंट हूं। मैं आज आपकी कैसे मदद कर सकती हूं?"

# OpenAI voices
OPENAI_VOICES = {
    "openai-nova": "nova",
    "openai-shimmer": "shimmer",
    "openai-alloy": "alloy",
    "openai-echo": "echo",
    "openai-fable": "fable",
    "openai-onyx": "onyx",
}

# Sarvam voices
SARVAM_VOICES = {
    "sarvam-meera": {"speaker": "meera", "lang": "hi-IN", "label": "Meera (F, Hindi)"},
    "sarvam-pavithra": {"speaker": "pavithra", "lang": "hi-IN", "label": "Pavithra (F, Hindi)"},
    "sarvam-maitreyi": {"speaker": "maitreyi", "lang": "hi-IN", "label": "Maitreyi (F, Hindi)"},
    "sarvam-arvind": {"speaker": "arvind", "lang": "hi-IN", "label": "Arvind (M, Hindi)"},
    "sarvam-amol": {"speaker": "amol", "lang": "hi-IN", "label": "Amol (M, Hindi)"},
    "sarvam-amartya": {"speaker": "amartya", "lang": "hi-IN", "label": "Amartya (M, Hindi)"},
}

# All previewable voices
ALL_VOICES = {**{k: {"type": "openai"} for k in OPENAI_VOICES}, **{k: {"type": "sarvam"} for k in SARVAM_VOICES}}


@router.get("/voices")
async def list_previewable_voices(tenant_id: str = Depends(get_tenant_id)):
    """List all voices that support preview."""
    voices = []
    for vid, vname in OPENAI_VOICES.items():
        voices.append({"id": vid, "name": vname.capitalize(), "vendor": "OpenAI", "type": "openai"})
    for vid, meta in SARVAM_VOICES.items():
        voices.append({"id": vid, "name": meta["label"], "vendor": "Sarvam AI", "type": "sarvam"})
    return voices


@router.get("/preview")
async def preview_voice(voice: str, tenant_id: str = Depends(get_tenant_id)):
    """Generate a short TTS audio sample for the given voice."""

    # OpenAI voices
    if voice in OPENAI_VOICES:
        return await _preview_openai(OPENAI_VOICES[voice])

    # Sarvam voices
    if voice in SARVAM_VOICES:
        return await _preview_sarvam(SARVAM_VOICES[voice])

    # Also handle bare sarvam provider ID
    if voice == "sarvam":
        return await _preview_sarvam(SARVAM_VOICES["sarvam-meera"])

    raise HTTPException(status_code=400, detail=f"Preview not available for '{voice}'.")


async def _preview_openai(openai_voice: str) -> Response:
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
                    "input": PREVIEW_TEXT_EN,
                    "voice": openai_voice,
                    "response_format": "mp3",
                },
            )
        resp.raise_for_status()
        return Response(
            content=resp.content,
            media_type="audio/mpeg",
            headers={"Cache-Control": "public, max-age=86400"},
        )
    except Exception as exc:
        logger.error("tts_preview_openai_failed", voice=openai_voice, error=str(exc))
        raise HTTPException(status_code=502, detail="TTS preview failed")


async def _preview_sarvam(voice_meta: dict) -> Response:
    api_key = os.getenv("SARVAM_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="Sarvam API key not configured. Set SARVAM_API_KEY.")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.sarvam.ai/text-to-speech",
                headers={
                    "API-Subscription-Key": api_key,
                    "Content-Type": "application/json",
                },
                json={
                    "inputs": [PREVIEW_TEXT_HI],
                    "target_language_code": voice_meta["lang"],
                    "speaker": voice_meta["speaker"],
                    "model": "bulbul:v1",
                    "pitch": 0,
                    "pace": 1.0,
                    "loudness": 1.5,
                    "speech_sample_rate": 22050,
                    "enable_preprocessing": True,
                },
            )
        resp.raise_for_status()
        data = resp.json()
        audio_b64 = data["audios"][0]
        wav_bytes = base64.b64decode(audio_b64)
        return Response(
            content=wav_bytes,
            media_type="audio/wav",
            headers={"Cache-Control": "public, max-age=86400"},
        )
    except Exception as exc:
        logger.error("tts_preview_sarvam_failed", voice=voice_meta["speaker"], error=str(exc))
        raise HTTPException(status_code=502, detail="Sarvam TTS preview failed")
