"""
Cartesia TTS — LiveKit Agents TTS plugin.

API: POST https://api.cartesia.ai/tts/bytes
Auth: X-API-Key header
Models: sonic-2, sonic-2-2025-03-07 (multilingual), sonic-english
Voices: many preset UUIDs — see https://play.cartesia.ai/

Latency: ~40ms first audio (industry-leading).

Install:
  pip install livekit-plugins-cartesia   (official plugin — preferred)
  OR use this custom plugin if the official one isn't available.
"""
import base64
import io
import os
import wave
from typing import AsyncIterator

import httpx
import structlog

logger = structlog.get_logger()

CARTESIA_API_URL = "https://api.cartesia.ai/tts/bytes"

# Default voice IDs per language (Cartesia preset voices)
DEFAULT_VOICES = {
    "en":    "a0e99841-438c-4a64-b679-ae501e7d6091",  # Barbossa (male, English)
    "hi":    "1f9b4e8c-5adb-4d62-a44a-2deee43d72e7",  # Hindi voice
    "multi": "a0e99841-438c-4a64-b679-ae501e7d6091",  # Sonic multilingual
}

# Try official Cartesia plugin first
try:
    from livekit.plugins import cartesia as cartesia_plugin
    _OFFICIAL_AVAILABLE = True
except ImportError:
    _OFFICIAL_AVAILABLE = False


def get_cartesia_tts(voice_id: str | None = None, language: str = "en", model: str = "sonic-2"):
    """
    Returns a Cartesia TTS instance.
    Prefers official livekit-plugins-cartesia if installed.
    Falls back to custom HTTP implementation.
    """
    api_key = os.getenv("CARTESIA_API_KEY", "")
    if not api_key:
        raise ValueError("CARTESIA_API_KEY not set")

    if _OFFICIAL_AVAILABLE:
        vid = voice_id or DEFAULT_VOICES.get(language, DEFAULT_VOICES["en"])
        return cartesia_plugin.TTS(
            model=model,
            voice=vid,
            api_key=api_key,
            language=language if language != "multi" else "en",
        )

    # Fallback: custom implementation
    return CartesiaTTSCustom(api_key=api_key, voice_id=voice_id, language=language, model=model)


# ─── Custom HTTP-based implementation (fallback) ──────────────────────────────

try:
    from livekit.agents.tts import TTS, TTSCapabilities, SynthesizeStream, SynthesizedAudio
    import livekit.agents.utils as agent_utils

    class CartesiaTTSStream(SynthesizeStream):
        def __init__(self, tts_instance, text: str):
            super().__init__(tts=tts_instance)
            self._text = text

        async def _run(self) -> None:
            api_key  = self._tts._api_key
            voice_id = self._tts._voice_id
            language = self._tts._language
            model    = self._tts._model

            payload = {
                "model_id": model,
                "transcript": self._text,
                "voice": {"mode": "id", "id": voice_id},
                "output_format": {
                    "container": "wav",
                    "encoding": "pcm_s16le",
                    "sample_rate": 24000,
                },
                "language": language if language != "multi" else "en",
            }

            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    r = await client.post(
                        CARTESIA_API_URL,
                        json=payload,
                        headers={"X-API-Key": api_key, "Cartesia-Version": "2024-06-10"},
                    )
                    r.raise_for_status()
                    wav_bytes = r.content
            except Exception as e:
                logger.error("cartesia_tts_failed", error=str(e))
                return

            # Parse WAV → raw PCM
            with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
                sample_rate = wf.getframerate()
                num_channels = wf.getnchannels()
                pcm_data = wf.readframes(wf.getnframes())

            frame = SynthesizedAudio(
                request_id=self._request_id,
                frame=agent_utils.AudioFrame(
                    data=pcm_data,
                    sample_rate=sample_rate,
                    num_channels=num_channels,
                    samples_per_channel=len(pcm_data) // (2 * num_channels),
                ),
            )
            self._event_ch.send_nowait(frame)

    class CartesiaTTSCustom(TTS):
        def __init__(self, *, api_key: str, voice_id: str | None = None, language: str = "en", model: str = "sonic-2"):
            super().__init__(
                capabilities=TTSCapabilities(streaming=False),
                sample_rate=24000,
                num_channels=1,
            )
            self._api_key   = api_key
            self._voice_id  = voice_id or DEFAULT_VOICES.get(language, DEFAULT_VOICES["en"])
            self._language  = language
            self._model     = model

        def synthesize(self, text: str, *, conn_options=None) -> CartesiaTTSStream:
            return CartesiaTTSStream(self, text)

except ImportError:
    # Stub when SDK not available
    class CartesiaTTSCustom:  # type: ignore
        def __init__(self, **kwargs):
            pass
