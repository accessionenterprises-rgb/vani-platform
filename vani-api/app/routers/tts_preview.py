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

# Sarvam voices (bulbul:v3 — Mar 2026)
SARVAM_VOICES = {
    "sarvam-priya":    {"speaker": "priya",    "lang": "hi-IN", "label": "Priya (F)"},
    "sarvam-neha":     {"speaker": "neha",     "lang": "hi-IN", "label": "Neha (F)"},
    "sarvam-shreya":   {"speaker": "shreya",   "lang": "hi-IN", "label": "Shreya (F)"},
    "sarvam-kavya":    {"speaker": "kavya",    "lang": "hi-IN", "label": "Kavya (F)"},
    "sarvam-simran":   {"speaker": "simran",   "lang": "hi-IN", "label": "Simran (F)"},
    "sarvam-ritu":     {"speaker": "ritu",     "lang": "hi-IN", "label": "Ritu (F)"},
    "sarvam-rahul":    {"speaker": "rahul",    "lang": "hi-IN", "label": "Rahul (M)"},
    "sarvam-amit":     {"speaker": "amit",     "lang": "hi-IN", "label": "Amit (M)"},
    "sarvam-dev":      {"speaker": "dev",      "lang": "hi-IN", "label": "Dev (M)"},
    "sarvam-rohan":    {"speaker": "rohan",    "lang": "hi-IN", "label": "Rohan (M)"},
    "sarvam-kabir":    {"speaker": "kabir",    "lang": "hi-IN", "label": "Kabir (M)"},
    "sarvam-aditya":   {"speaker": "aditya",   "lang": "hi-IN", "label": "Aditya (M)"},
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
async def preview_voice(voice: str, lang: str = "hi", tenant_id: str = Depends(get_tenant_id)):
    """Generate a short TTS audio sample for the given voice. lang=en or lang=hi."""

    # OpenAI voices
    if voice in OPENAI_VOICES:
        return await _preview_openai(OPENAI_VOICES[voice])

    # Sarvam voices
    if voice in SARVAM_VOICES:
        return await _preview_sarvam(SARVAM_VOICES[voice], lang)

    # Also handle bare sarvam provider ID
    if voice == "sarvam":
        return await _preview_sarvam(SARVAM_VOICES["sarvam-priya"], lang)

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


async def _preview_sarvam(voice_meta: dict, lang: str = "hi") -> Response:
    api_key = os.getenv("SARVAM_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="Sarvam API key not configured. Set SARVAM_API_KEY.")

    preview_text = PREVIEW_TEXT_EN if lang == "en" else PREVIEW_TEXT_HI
    lang_code = "en-IN" if lang == "en" else "hi-IN"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.sarvam.ai/text-to-speech",
                headers={
                    "API-Subscription-Key": api_key,
                    "Content-Type": "application/json",
                },
                json={
                    "inputs": [preview_text],
                    "target_language_code": lang_code,
                    "speaker": voice_meta["speaker"],
                    "model": "bulbul:v3",
                    "pace": 1.0,
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
