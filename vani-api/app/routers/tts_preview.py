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


GEMINI_LIVE_VOICES = [
    "Zephyr", "Kore", "Orus", "Autonoe", "Umbriel", "Erinome", "Laomedeia",
    "Schedar", "Achird", "Sadachbia", "Puck", "Fenrir", "Aoede", "Enceladus",
    "Algieba", "Algenib", "Achernar", "Gacrux", "Zubenelgenubi", "Sadaltager",
    "Charon", "Leda", "Callirrhoe", "Iapetus", "Despina", "Rasalgethi",
    "Alnilam", "Pulcherrima", "Vindemiatrix", "Sulafat",
]


@router.get("/voices")
async def list_previewable_voices(tenant_id: str = Depends(get_tenant_id)):
    """List all voices that support preview."""
    voices = []
    for vid, vname in OPENAI_VOICES.items():
        voices.append({"id": vid, "name": vname.capitalize(), "vendor": "OpenAI", "type": "openai"})
    for vid, meta in SARVAM_VOICES.items():
        voices.append({"id": vid, "name": meta["speaker"].capitalize(), "vendor": "Sarvam AI", "type": "sarvam", "model": meta.get("model", "bulbul:v2")})
    for v in GEMINI_LIVE_VOICES:
        voices.append({"id": v, "name": v, "vendor": "Google", "type": "gemini-live"})
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

    # Gemini Live voices
    if voice in GEMINI_LIVE_VOICES:
        static_file = STATIC_DIR / f"gemini-{voice}.mp3"
        if static_file.exists():
            return FileResponse(static_file, media_type="audio/mpeg",
                                headers={"Cache-Control": "public, max-age=604800"})
        return await _preview_gemini_live(voice)

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


def _pcm_to_wav(pcm_bytes: bytes, sample_rate: int = 24000, channels: int = 1, bits: int = 16) -> bytes:
    """Wrap raw PCM bytes in a WAV header."""
    import struct
    data_size = len(pcm_bytes)
    byte_rate = sample_rate * channels * bits // 8
    block_align = channels * bits // 8
    header = struct.pack(
        '<4sI4s4sIHHIIHH4sI',
        b'RIFF', 36 + data_size, b'WAVE',
        b'fmt ', 16, 1, channels, sample_rate, byte_rate, block_align, bits,
        b'data', data_size,
    )
    return header + pcm_bytes


async def _preview_gemini_live(voice_name: str) -> Response:
    """Generate a voice preview using Gemini's TTS API."""
    api_key = os.getenv("GOOGLE_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="Google API key not configured")
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key={api_key}",
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": PREVIEW_TEXT_EN}]}],
                    "generationConfig": {
                        "responseModalities": ["AUDIO"],
                        "speechConfig": {
                            "voiceConfig": {
                                "prebuiltVoiceConfig": {"voiceName": voice_name}
                            }
                        },
                    },
                },
            )
        resp.raise_for_status()
        data = resp.json()
        # Extract audio from response — Gemini returns raw PCM (audio/L16), wrap in WAV
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        for part in parts:
            inline = part.get("inlineData", {})
            mime = inline.get("mimeType", "")
            if mime.startswith("audio/"):
                pcm_bytes = base64.b64decode(inline["data"])
                # Parse sample rate from mime (audio/L16;codec=pcm;rate=24000)
                rate = 24000
                for token in mime.split(";"):
                    if token.strip().startswith("rate="):
                        rate = int(token.strip().split("=")[1])
                wav_bytes = _pcm_to_wav(pcm_bytes, sample_rate=rate)
                return Response(
                    content=wav_bytes,
                    media_type="audio/wav",
                    headers={"Cache-Control": "public, max-age=86400"},
                )
        raise HTTPException(status_code=502, detail="No audio in Gemini response")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("tts_preview_gemini_failed", voice=voice_name, error=str(exc))
        raise HTTPException(status_code=502, detail="Gemini voice preview failed")
