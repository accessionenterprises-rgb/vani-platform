"""
Sarvam AI TTS — LiveKit Agents TTS plugin (SDK v1.5+).

API: POST https://api.sarvam.ai/text-to-speech
Auth: API-Subscription-Key header
Response: { "audios": ["<base64_wav>"] }
"""
import base64
import io
import wave

import httpx

try:
    from livekit.agents import tts, utils
    from livekit.agents.tts import (
        TTS,
        TTSCapabilities,
        ChunkedStream,
        SynthesizedAudio,
    )
    from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS, APIConnectOptions
    _SDK_AVAILABLE = True
except ImportError:
    _SDK_AVAILABLE = False

SARVAM_API_URL = "https://api.sarvam.ai/text-to-speech"

VOICE_MAP = {
    "priya": "priya", "neha": "neha", "shreya": "shreya", "kavya": "kavya",
    "simran": "simran", "ritu": "ritu", "pooja": "pooja", "ishita": "ishita",
    "roopa": "roopa", "tanya": "tanya", "shruti": "shruti", "suhani": "suhani",
    "rupali": "rupali", "kavitha": "kavitha", "amelia": "amelia", "sophia": "sophia",
    "niharika": "niharika",
    "rahul": "rahul", "amit": "amit", "dev": "dev", "rohan": "rohan",
    "kabir": "kabir", "aditya": "aditya", "ashutosh": "ashutosh", "ratan": "ratan",
    "varun": "varun", "manan": "manan", "sumit": "sumit", "aayan": "aayan",
    "shubh": "shubh", "advait": "advait", "anand": "anand", "tarun": "tarun",
    "sunny": "sunny", "mani": "mani", "gokul": "gokul", "vijay": "vijay",
    "mohit": "mohit", "rehan": "rehan", "soham": "soham",
}

LANG_MAP = {
    "en": "en-IN", "hi": "hi-IN", "multi": "hi-IN",
    "bn": "bn-IN", "ta": "ta-IN", "te": "te-IN",
}


async def _call_sarvam(text: str, voice: str, language: str, api_key: str) -> bytes:
    """Call Sarvam TTS API and return raw WAV bytes."""
    lang_code = LANG_MAP.get(language, "en-IN")
    speaker = VOICE_MAP.get(voice, voice)

    payload = {
        "inputs": [text],
        "target_language_code": lang_code,
        "speaker": speaker,
        "model": "bulbul:v3",
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
        if r.status_code != 200:
            print(f">>> Sarvam TTS error: {r.status_code} | voice={speaker} | lang={lang_code} | text_len={len(text)} | response={r.text[:300]}", flush=True)
        r.raise_for_status()
        data = r.json()

    return base64.b64decode(data["audios"][0])


if _SDK_AVAILABLE:

    class _SarvamChunkedStream(ChunkedStream):
        """Non-streaming TTS: calls Sarvam API, returns full audio as one chunk."""

        def __init__(
            self,
            *,
            tts_instance: "SarvamTTS",
            input_text: str,
            conn_options: APIConnectOptions,
        ):
            super().__init__(
                tts=tts_instance,
                input_text=input_text,
                conn_options=conn_options,
            )

        async def _run(self, output_emitter: tts.AudioEmitter) -> None:
            wav_bytes = await _call_sarvam(
                self._input_text,
                self._tts._voice,
                self._tts._language,
                self._tts._api_key,
            )

            # Parse WAV to get PCM data
            with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
                sample_rate = wf.getframerate()
                num_channels = wf.getnchannels()
                pcm_data = wf.readframes(wf.getnframes())

            request_id = utils.shortuuid()

            output_emitter.initialize(
                request_id=request_id,
                sample_rate=sample_rate,
                num_channels=num_channels,
                mime_type="audio/pcm",
            )
            output_emitter.push(pcm_data)
            output_emitter.flush()
            output_emitter.end_input()

    class SarvamTTS(TTS):
        """Sarvam AI TTS plugin for LiveKit Agents v1.5+."""

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

        def synthesize(
            self,
            text: str,
            *,
            conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS,
        ) -> _SarvamChunkedStream:
            return _SarvamChunkedStream(
                tts_instance=self,
                input_text=text,
                conn_options=conn_options,
            )

else:
    class SarvamTTS:  # type: ignore
        def __init__(self, *, api_key: str, voice: str = "priya", language: str = "en"):
            self._api_key = api_key
            self._voice = voice
            self._language = language

        async def synthesize_raw(self, text: str) -> bytes:
            return await _call_sarvam(text, self._voice, self._language, self._api_key)
