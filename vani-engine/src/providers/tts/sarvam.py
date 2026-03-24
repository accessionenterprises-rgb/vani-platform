"""
Sarvam AI TTS — LiveKit Agents TTS plugin (SDK v1.5+).
Uses WebSocket streaming API for low-latency real-time synthesis.

WebSocket URL: wss://api.sarvam.ai/text-to-speech/ws
Auth: Api-Subscription-Key header
"""
import base64
import io
import json
import wave

import httpx

try:
    from livekit.agents import tts, utils
    from livekit.agents.tts import TTS, TTSCapabilities, ChunkedStream
    from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS, APIConnectOptions
    _SDK_AVAILABLE = True
except ImportError:
    _SDK_AVAILABLE = False

SARVAM_WS_URL = "wss://api.sarvam.ai/text-to-speech/ws"
SARVAM_HTTP_URL = "https://api.sarvam.ai/text-to-speech"

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
    "mr": "mr-IN", "gu": "gu-IN", "kn": "kn-IN",
    "ml": "ml-IN", "pa": "pa-IN", "od": "od-IN",
}


if _SDK_AVAILABLE:
    import aiohttp

    class _SarvamStreamingChunkedStream(ChunkedStream):
        """Streaming TTS via Sarvam WebSocket — low latency, progressive audio."""

        def __init__(self, *, tts_instance: "SarvamTTS", input_text: str, conn_options: APIConnectOptions):
            super().__init__(tts=tts_instance, input_text=input_text, conn_options=conn_options)

        async def _run(self, output_emitter: tts.AudioEmitter) -> None:
            api_key = self._tts._api_key
            speaker = self._tts._voice
            lang_code = self._tts._lang_code
            model = self._tts._model
            sample_rate = 24000 if model == "bulbul:v3" else 22050

            request_id = utils.shortuuid()
            output_emitter.initialize(
                request_id=request_id,
                sample_rate=sample_rate,
                num_channels=1,
                mime_type="audio/pcm",
            )

            ws_url = f"{SARVAM_WS_URL}?model={model}&send_completion_event=true"
            headers = {"Api-Subscription-Key": api_key}

            try:
                async with aiohttp.ClientSession() as session:
                    async with session.ws_connect(ws_url, headers=headers, timeout=30) as ws:
                        # Send config
                        config = {
                            "type": "config",
                            "data": {
                                "target_language_code": lang_code,
                                "speaker": speaker,
                                "model": model,
                                "speech_sample_rate": str(sample_rate),
                                "output_audio_codec": "wav",
                                "enable_preprocessing": True,
                            }
                        }
                        if model == "bulbul:v3":
                            config["data"]["temperature"] = 0.6
                        await ws.send_str(json.dumps(config))

                        # Send text
                        await ws.send_str(json.dumps({
                            "type": "text",
                            "data": {"text": self._input_text}
                        }))

                        # Flush to process immediately
                        await ws.send_str(json.dumps({"type": "flush"}))

                        # Receive audio chunks
                        async for msg in ws:
                            if msg.type == aiohttp.WSMsgType.TEXT:
                                data = json.loads(msg.data)
                                if data.get("type") == "audio":
                                    audio_b64 = data["data"]["audio"]
                                    audio_bytes = base64.b64decode(audio_b64)

                                    # Parse WAV to get PCM
                                    try:
                                        with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
                                            pcm = wf.readframes(wf.getnframes())
                                        output_emitter.push(pcm)
                                    except Exception:
                                        # Raw PCM if not WAV
                                        output_emitter.push(audio_bytes)

                                elif data.get("type") == "completion":
                                    break
                                elif data.get("type") == "error":
                                    print(f">>> Sarvam WS error: {data}", flush=True)
                                    break
                            elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.ERROR):
                                break

                        output_emitter.flush()
                        output_emitter.end_input()

            except Exception as e:
                print(f">>> Sarvam streaming failed: {e}, falling back to HTTP", flush=True)
                # Fallback to HTTP batch
                await self._http_fallback(output_emitter, request_id, sample_rate)

        async def _http_fallback(self, output_emitter, request_id, sample_rate):
            """Fallback to batch HTTP if WebSocket fails."""
            api_key = self._tts._api_key
            speaker = self._tts._voice
            lang_code = self._tts._lang_code
            model = self._tts._model

            payload = {
                "inputs": [self._input_text],
                "target_language_code": lang_code,
                "speaker": speaker,
                "model": model,
            }

            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(
                    SARVAM_HTTP_URL,
                    json=payload,
                    headers={
                        "API-Subscription-Key": api_key,
                        "Content-Type": "application/json",
                    },
                )
                if r.status_code != 200:
                    print(f">>> Sarvam HTTP fallback error: {r.status_code} {r.text[:200]}", flush=True)
                    return
                data = r.json()

            wav_bytes = base64.b64decode(data["audios"][0])
            with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
                pcm = wf.readframes(wf.getnframes())

            if not hasattr(output_emitter, '_started') or not output_emitter._started:
                output_emitter.initialize(
                    request_id=request_id,
                    sample_rate=sample_rate,
                    num_channels=1,
                    mime_type="audio/pcm",
                )
            output_emitter.push(pcm)
            output_emitter.flush()
            output_emitter.end_input()


    class SarvamTTS(TTS):
        """Sarvam AI TTS — WebSocket streaming for low latency."""

        def __init__(self, *, api_key: str, voice: str = "priya", language: str = "en"):
            super().__init__(
                capabilities=TTSCapabilities(streaming=False),
                sample_rate=24000,
                num_channels=1,
            )
            self._api_key = api_key
            self._voice = VOICE_MAP.get(voice, voice)
            self._lang_code = LANG_MAP.get(language, "en-IN")
            self._language = language
            self._model = "bulbul:v3"

        def synthesize(self, text: str, *, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS) -> _SarvamStreamingChunkedStream:
            return _SarvamStreamingChunkedStream(
                tts_instance=self, input_text=text, conn_options=conn_options,
            )

else:
    class SarvamTTS:  # type: ignore
        def __init__(self, *, api_key: str, voice: str = "priya", language: str = "en"):
            self._api_key = api_key
            self._voice = voice
            self._language = language
