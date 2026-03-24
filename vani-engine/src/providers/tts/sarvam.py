"""
Sarvam AI TTS — LiveKit Agents TTS plugin.

API: POST https://api.sarvam.ai/text-to-speech
Auth: API-Subscription-Key header
Response: { "audios": ["<base64_wav>"] }

Voices: anushka, manisha, priya, neha, shreya, kavya (F) | abhilash, rahul, amit, dev, rohan, kabir (M)
Languages: en-IN, hi-IN, bn-IN, kn-IN, ml-IN, mr-IN, od-IN, pa-IN, ta-IN, te-IN, gu-IN
"""
import base64
import io
import wave
from typing import AsyncIterator

import httpx

# Try to import from LiveKit Agents SDK
try:
    from livekit.agents import tts
    from livekit.agents.tts import TTS, TTSCapabilities, SynthesizedAudio, SynthesizeStream
    _SDK_AVAILABLE = True
except ImportError:
    _SDK_AVAILABLE = False

SARVAM_API_URL = "https://api.sarvam.ai/text-to-speech"

VOICE_MAP = {
    "priya":    "priya",
    "neha":     "neha",
    "shreya":   "shreya",
    "kavya":    "kavya",
    "simran":   "simran",
    "ritu":     "ritu",
    "rahul":    "rahul",
    "amit":     "amit",
    "dev":      "dev",
    "rohan":    "rohan",
    "kabir":    "kabir",
    "aditya":   "aditya",
}

LANG_MAP = {
    "en":    "en-IN",
    "hi":    "hi-IN",
    "multi": "hi-IN",   # default for multi — Sarvam handles Hinglish well
    "bn":    "bn-IN",
    "ta":    "ta-IN",
    "te":    "te-IN",
}


def _wav_bytes_to_pcm(wav_bytes: bytes) -> tuple[bytes, int, int]:
    """Extract raw PCM from WAV bytes. Returns (pcm_data, sample_rate, num_channels)."""
    with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
        sample_rate = wf.getframerate()
        num_channels = wf.getnchannels()
        pcm_data = wf.readframes(wf.getnframes())
    return pcm_data, sample_rate, num_channels


async def _call_sarvam(text: str, voice: str, language: str, api_key: str) -> bytes:
    """Call Sarvam TTS API and return raw WAV bytes."""
    lang_code = LANG_MAP.get(language, "en-IN")
    speaker = VOICE_MAP.get(voice, "priya")

    payload = {
        "inputs": [text],
        "target_language_code": lang_code,
        "speaker": speaker,
        "model": "bulbul:v3",
        "pace": 1.0,
        "speech_sample_rate": 22050,
        "enable_preprocessing": True,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            SARVAM_API_URL,
            json=payload,
            headers={
                "API-Subscription-Key": api_key,
                "Content-Type": "application/json",
            },
        )
        r.raise_for_status()
        data = r.json()

    audio_b64 = data["audios"][0]
    return base64.b64decode(audio_b64)


if _SDK_AVAILABLE:
    import asyncio
    from livekit.agents.tts import ChunkedStream
    import livekit.agents.utils as agent_utils

    class SarvamTTSStream(SynthesizeStream):
        def __init__(self, tts_instance, text: str, *, conn_options=None):
            # SDK v1.5+ requires conn_options; use default if not provided
            init_kwargs = {"tts": tts_instance}
            if conn_options is not None:
                init_kwargs["conn_options"] = conn_options
            else:
                try:
                    from livekit.agents.tts import DEFAULT_API_CONNECT_OPTIONS
                    init_kwargs["conn_options"] = DEFAULT_API_CONNECT_OPTIONS
                except ImportError:
                    pass
            super().__init__(**init_kwargs)
            self._text = text

        async def _run(self) -> None:
            wav_bytes = await _call_sarvam(
                self._text,
                self._tts._voice,
                self._tts._language,
                self._tts._api_key,
            )
            pcm, sample_rate, channels = _wav_bytes_to_pcm(wav_bytes)
            frame = tts.SynthesizedAudio(
                request_id=self._request_id,
                frame=agent_utils.AudioFrame(
                    data=pcm,
                    sample_rate=sample_rate,
                    num_channels=channels,
                    samples_per_channel=len(pcm) // (2 * channels),
                ),
            )
            self._event_ch.send_nowait(frame)

    class SarvamTTS(TTS):
        """Sarvam AI TTS plugin for LiveKit Agents."""

        def __init__(
            self,
            *,
            api_key: str,
            voice: str = "priya",
            language: str = "en",
        ):
            super().__init__(
                capabilities=TTSCapabilities(streaming=False),
                sample_rate=22050,
                num_channels=1,
            )
            self._api_key = api_key
            self._voice = VOICE_MAP.get(voice, voice)
            self._language = language

        def synthesize(self, text: str, *, conn_options=None) -> SarvamTTSStream:
            return SarvamTTSStream(self, text, conn_options=conn_options)

else:
    # Fallback stub when SDK not installed
    class SarvamTTS:  # type: ignore
        def __init__(self, *, api_key: str, voice: str = "meera", language: str = "en"):
            self._api_key = api_key
            self._voice = voice
            self._language = language

        async def synthesize_raw(self, text: str) -> bytes:
            return await _call_sarvam(text, self._voice, self._language, self._api_key)
