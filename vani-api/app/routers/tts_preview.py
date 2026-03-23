"""
TTS voice preview — serves pre-generated audio samples for instant playback.
Falls back to live API call if static file is missing.

GET /tts/preview?voice=sarvam-priya&lang=en  → static WAV
GET /tts/preview?voice=openai-nova            → static MP3
"""
import base64
import os
from pathlib import Path

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, Response

from app.middleware.auth import get_tenant_id

logger = structlog.get_logger()

router = APIRouter(prefix="/tts", tags=["tts"])

STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "static" / "voice-previews"

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
    "sarvam-priya":    {"speaker": "priya",    "label": "Priya (F)"},
    "sarvam-neha":     {"speaker": "neha",     "label": "Neha (F)"},
    "sarvam-shreya":   {"speaker": "shreya",   "label": "Shreya (F)"},
    "sarvam-kavya":    {"speaker": "kavya",    "label": "Kavya (F)"},
    "sarvam-simran":   {"speaker": "simran",   "label": "Simran (F)"},
    "sarvam-ritu":     {"speaker": "ritu",     "label": "Ritu (F)"},
    "sarvam-rahul":    {"speaker": "rahul",    "label": "Rahul (M)"},
    "sarvam-amit":     {"speaker": "amit",     "label": "Amit (M)"},
    "sarvam-dev":      {"speaker": "dev",      "label": "Dev (M)"},
    "sarvam-rohan":    {"speaker": "rohan",    "label": "Rohan (M)"},
    "sarvam-kabir":    {"speaker": "kabir",    "label": "Kabir (M)"},
    "sarvam-aditya":   {"speaker": "aditya",   "label": "Aditya (M)"},
}


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
    """Serve a pre-generated voice preview. Falls back to live API if static file missing."""

    # Sarvam voices — try static file first
    if voice in SARVAM_VOICES or voice == "sarvam":
        vid = voice if voice in SARVAM_VOICES else "sarvam-priya"
        static_file = STATIC_DIR / f"{vid}-{lang}.wav"
        if static_file.exists():
            return FileResponse(static_file, media_type="audio/wav",
                                headers={"Cache-Control": "public, max-age=604800"})
        # Fallback to live API
        meta = SARVAM_VOICES.get(vid, SARVAM_VOICES["sarvam-priya"])
        return await _preview_sarvam_live(meta, lang)

    # OpenAI voices — try static file first
    if voice in OPENAI_VOICES:
        static_file = STATIC_DIR / f"{voice}.mp3"
        if static_file.exists():
            return FileResponse(static_file, media_type="audio/mpeg",
                                headers={"Cache-Control": "public, max-age=604800"})
        return await _preview_openai_live(OPENAI_VOICES[voice])

    raise HTTPException(status_code=400, detail=f"Preview not available for '{voice}'.")


async def _preview_openai_live(openai_voice: str) -> Response:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.openai.com/v1/audio/speech",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": "tts-1", "input": PREVIEW_TEXT_EN, "voice": openai_voice, "response_format": "mp3"},
            )
        resp.raise_for_status()
        return Response(content=resp.content, media_type="audio/mpeg",
                        headers={"Cache-Control": "public, max-age=86400"})
    except Exception as exc:
        logger.error("tts_preview_openai_failed", voice=openai_voice, error=str(exc))
        raise HTTPException(status_code=502, detail="TTS preview failed")


async def _preview_sarvam_live(voice_meta: dict, lang: str = "hi") -> Response:
    api_key = os.getenv("SARVAM_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="Sarvam API key not configured")
    preview_text = PREVIEW_TEXT_EN if lang == "en" else PREVIEW_TEXT_HI
    lang_code = "en-IN" if lang == "en" else "hi-IN"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.sarvam.ai/text-to-speech",
                headers={"API-Subscription-Key": api_key, "Content-Type": "application/json"},
                json={
                    "inputs": [preview_text], "target_language_code": lang_code,
                    "speaker": voice_meta["speaker"], "model": "bulbul:v3",
                    "pace": 1.0, "speech_sample_rate": 22050, "enable_preprocessing": True,
                },
            )
        resp.raise_for_status()
        data = resp.json()
        wav_bytes = base64.b64decode(data["audios"][0])
        return Response(content=wav_bytes, media_type="audio/wav",
                        headers={"Cache-Control": "public, max-age=86400"})
    except Exception as exc:
        logger.error("tts_preview_sarvam_failed", voice=voice_meta["speaker"], error=str(exc))
        raise HTTPException(status_code=502, detail="Sarvam TTS preview failed")
