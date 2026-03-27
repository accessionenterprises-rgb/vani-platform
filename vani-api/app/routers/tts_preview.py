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

router = APIRouter(prefix="/tts", tags=["TTS Preview"])

STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "static" / "voice-previews"

PREVIEW_TEXT_EN = "Hi there! Thanks for calling. I'm your AI assistant and I'm here to help you today. How can I assist you?"
PREVIEW_TEXT_HI = "नमस्ते! कॉल करने के लिए धन्यवाद। मैं आपकी AI असिस्टेंट हूं। मैं आज आपकी कैसे मदद कर सकती हूं?"

# OpenAI voices (TTS-1 + new voices)
OPENAI_VOICES = {f"openai-{v}": v for v in [
    "alloy", "ash", "ballad", "cedar", "coral", "echo",
    "fable", "marin", "nova", "onyx", "sage", "shimmer", "verse",
]}

# Sarvam v2 voices (bulbul:v2)
_SARVAM_V2 = {"anushka", "abhilash", "manisha", "vidya", "arya", "karun", "hitesh"}

# All Sarvam voices (v2 + v3)
SARVAM_VOICES = {}
for v in ["anushka", "abhilash", "manisha", "vidya", "arya", "karun", "hitesh"]:
    SARVAM_VOICES[f"sarvam-{v}"] = {"speaker": v, "model": "bulbul:v2"}
for v in ["priya","neha","shreya","kavya","simran","ritu","pooja","ishita","roopa",
    "tanya","shruti","suhani","rupali","kavitha","amelia","sophia",
    "rahul","amit","dev","rohan","kabir","aditya","ashutosh","ratan","varun",
    "manan","sumit","aayan","shubh","advait","anand","tarun","sunny","mani",
    "gokul","vijay","mohit","rehan","soham"]:
    SARVAM_VOICES[f"sarvam-{v}"] = {"speaker": v, "model": "bulbul:v3"}


@router.get("/voices")
async def list_previewable_voices(tenant_id: str = Depends(get_tenant_id)):
    """List all voices that support preview."""
    voices = []
    for vid, vname in OPENAI_VOICES.items():
        voices.append({"id": vid, "name": vname.capitalize(), "vendor": "OpenAI", "type": "openai"})
    for vid, meta in SARVAM_VOICES.items():
        voices.append({"id": vid, "name": meta["speaker"].capitalize(), "vendor": "Sarvam AI", "type": "sarvam", "model": meta.get("model", "bulbul:v2")})
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
    # Try tts-1 first, fall back to gpt-4o-mini-tts for newer voices
    for model in ["tts-1", "gpt-4o-mini-tts"]:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/audio/speech",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"model": model, "input": PREVIEW_TEXT_EN, "voice": openai_voice, "response_format": "mp3"},
                )
            resp.raise_for_status()
            return Response(content=resp.content, media_type="audio/mpeg",
                            headers={"Cache-Control": "public, max-age=86400"})
        except Exception:
            continue
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
                headers={"api-subscription-key": api_key, "Content-Type": "application/json"},
                json={
                    "inputs": [preview_text], "target_language_code": lang_code,
                    "speaker": voice_meta["speaker"], "model": voice_meta.get("model", "bulbul:v2"),
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
