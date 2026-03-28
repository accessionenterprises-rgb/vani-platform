"""
Twilio Media Streams — fully configurable STT / LLM / TTS pipeline.

  Twilio WS → STT → LLM → TTS → Twilio WS

STT providers:
  deepgram-nova-3 / deepgram-nova-2 / deepgram-*  → Deepgram streaming WebSocket
  sarvam-saaras                                    → Sarvam AI streaming
  anything else                                    → OpenAI Whisper (buffered)

LLM providers:
  gpt-4o / gpt-4o-mini / gpt-4.1 / gpt-4.1-mini / gpt-4.1-nano → OpenAI
  gpt-5 / gpt-5-mini / gpt-5-nano / gpt-5.4       → aliased to GPT-4o equivalents
  mistral-*                                        → Mistral AI
  custom_llm_url                                   → custom OpenAI-compatible endpoint
  gpt-4o-mini-realtime / gpt-4o-realtime           → OpenAI Realtime (separate path)

TTS providers:
  openai / openai-<voice>                          → OpenAI TTS (tts-1)
  cartesia                                         → Cartesia sonic-2 8kHz native
  sarvam / sarvam-<voice>                          → Sarvam AI TTS

Audio on the wire: g711_ulaw (mulaw) 8 kHz — Twilio native.
"""
import asyncio
import base64
import io
import json
import wave

import httpx
import structlog
import websockets
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

try:
    import audioop
except ImportError:
    import audioop_lts as audioop  # Python 3.13+

import numpy as np
from scipy.signal import resample_poly


def _resample_24k_to_8k(pcm_24k: bytes) -> bytes:
    """High-quality resample 24kHz PCM-16 to 8kHz using scipy polyphase filter.
    This is vastly better than audioop.ratecv — proper anti-aliasing, no artifacts."""
    samples = np.frombuffer(pcm_24k, dtype=np.int16).astype(np.float64)
    resampled = resample_poly(samples, up=1, down=3)
    return resampled.astype(np.int16).tobytes()

def _resample_16k_to_8k(pcm_16k: bytes) -> bytes:
    """Resample 16kHz PCM-16 to 8kHz."""
    samples = np.frombuffer(pcm_16k, dtype=np.int16).astype(np.float64)
    resampled = resample_poly(samples, up=1, down=2)
    return resampled.astype(np.int16).tobytes()

from config import settings
from db import get_db
from redis_client import get_redis
from services.state_manager import update_status
from models.call_state import CallStatus

logger = structlog.get_logger()
router = APIRouter(tags=["media-stream"])


def _enhance_for_telephone(pcm_8k: bytes) -> bytes:
    """Retell-level audio chain for telephone playback.
    Target: clear consonants, consistent loudness, forward presence, no harshness.
    Optimized for 300-3400 Hz PSTN band.

    Chain: highpass → presence EQ → compression → de-esser → limiter → normalize
    """
    from scipy.signal import butter, lfilter
    if len(pcm_8k) < 4:
        return pcm_8k

    # Convert to float64 normalized [-1, 1]
    samples = np.frombuffer(pcm_8k, dtype=np.int16).astype(np.float64) / 32768.0

    # [1] High-pass filter — remove rumble below 120Hz (wasted in PSTN)
    b, a = butter(2, 120.0 / 4000.0, btype='high')
    samples = lfilter(b, a, samples)

    # [2] Presence EQ — boost 2-3kHz region (+3dB) for speech clarity
    # Bandpass around 2.5kHz, mix boosted signal back
    b_bp, a_bp = butter(2, [2000.0 / 4000.0, 3200.0 / 4000.0], btype='band')
    presence = lfilter(b_bp, a_bp, samples)
    samples = samples + presence * 0.4  # ~+3dB boost in presence range

    # [3] Compression — consistent volume, ratio 3:1, threshold ~-18dB
    threshold = 0.12
    ratio = 3.0
    for i in range(len(samples)):
        mag = abs(samples[i])
        if mag > threshold:
            sign = np.sign(samples[i])
            excess = mag - threshold
            samples[i] = sign * (threshold + excess / ratio)

    # [4] De-esser — tame harsh sibilants after EQ boost
    samples = np.tanh(samples * 0.95) / 0.95  # soft saturation, preserves level

    # [5] Limiter — prevent clipping at -1dB
    samples = np.clip(samples, -0.89, 0.89)

    # [6] Normalize — maximize signal, leave headroom
    peak = np.max(np.abs(samples))
    if peak > 0.001:
        samples = samples * (0.88 / peak)

    # Convert back to PCM-16
    pcm = (samples * 32767).astype(np.int16).tobytes()
    return pcm

# Deepgram streaming — mulaw 8 kHz, server VAD endpointing
DEEPGRAM_URL = (
    "wss://api.deepgram.com/v1/listen"
    "?encoding=mulaw&sample_rate=8000&channels=1&endpointing=300"
)

_VALID_OAI_VOICES = {
    "alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx",
    "sage", "shimmer", "verse", "marin", "cedar",
}
# Default Cartesia voice (dashboard default)
_CARTESIA_DEFAULT_VOICE = "f786b574-daa5-4673-aa0c-cbe3e8534c02"

# GPT-5 aliases → best available equivalents
_LLM_ALIASES = {
    "gpt-4-mini":   "gpt-4o-mini",
}

WHISPER_FLUSH_BYTES = 24_000  # ~3 s of mulaw at 8 kHz


# ── Voice helpers ─────────────────────────────────────────────────────────────

def _oai_voice(raw: str) -> str:
    """Extract OpenAI voice name from provider string like 'openai-nova' → 'nova'."""
    v = raw.replace("openai-", "").strip() if raw.startswith("openai-") else raw
    return v if v in _VALID_OAI_VOICES else "alloy"

def _cartesia_voice(raw: str) -> str:
    """Return Cartesia voice UUID. If raw looks like a UUID use it, else use default."""
    return raw if (len(raw) > 20 and "-" in raw) else _CARTESIA_DEFAULT_VOICE


# ── TTS ──────────────────────────────────────────────────────────────────────

async def _tts_openai(text: str, voice: str) -> bytes:
    """OpenAI TTS (tts-1) → PCM-16 24 kHz → resample → mulaw 8 kHz."""
    voice = _oai_voice(voice)
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.openai.com/v1/audio/speech",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json={"model": "tts-1", "input": text, "voice": voice,
                  "response_format": "pcm"},
        )
        r.raise_for_status()
    pcm_8k = _resample_24k_to_8k(r.content)
    pcm_8k = _enhance_for_telephone(pcm_8k)
    return audioop.lin2ulaw(pcm_8k, 2)


async def _tts_cartesia(text: str, voice_id: str) -> bytes:
    """Cartesia sonic-2 streaming → raw PCM-16 8kHz chunks → mulaw.
    Uses HTTP streaming (chunked transfer) for faster first-byte.
    Falls back to REST if streaming fails."""
    import ssl
    try:
        # Streaming endpoint — returns raw PCM chunks as they generate
        async with httpx.AsyncClient(timeout=20) as client:
            async with client.stream("POST",
                "https://api.cartesia.ai/tts/bytes",
                headers={
                    "X-API-Key": settings.cartesia_api_key,
                    "Cartesia-Version": "2024-06-10",
                    "Content-Type": "application/json",
                },
                json={
                    "model_id": "sonic-2",
                    "transcript": text,
                    "voice": {"mode": "id", "id": voice_id},
                    "output_format": {
                        "container": "raw",
                        "encoding": "pcm_s16le",
                        "sample_rate": 8000,
                    },
                },
            ) as resp:
                resp.raise_for_status()
                pcm_chunks = []
                async for chunk in resp.aiter_bytes(4096):
                    pcm_chunks.append(chunk)
                pcm_8k = b"".join(pcm_chunks)
        pcm_8k = _enhance_for_telephone(pcm_8k)
        return audioop.lin2ulaw(pcm_8k, 2)
    except Exception:
        # Fallback to WAV endpoint
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://api.cartesia.ai/tts/bytes",
                headers={
                    "X-API-Key": settings.cartesia_api_key,
                    "Cartesia-Version": "2024-06-10",
                    "Content-Type": "application/json",
                },
                json={
                    "model_id": "sonic-2",
                    "transcript": text,
                    "voice": {"mode": "id", "id": voice_id},
                    "output_format": {
                        "container": "wav",
                        "encoding": "pcm_s16le",
                        "sample_rate": 8000,
                    },
                },
            )
            r.raise_for_status()
        with wave.open(io.BytesIO(r.content), "rb") as wf:
            pcm_8k = wf.readframes(wf.getnframes())
        pcm_8k = _enhance_for_telephone(pcm_8k)
        return audioop.lin2ulaw(pcm_8k, 2)


async def _tts_sarvam(text: str, voice: str, language: str = "en-IN", provider: str = "sarvam") -> bytes:
    """Sarvam AI TTS → WAV → resample → mulaw 8 kHz."""
    speaker = voice.replace("sarvam-", "") if voice.startswith("sarvam-") else voice
    # Reject invalid speaker names (provider names, empty, etc)
    if not speaker or speaker in ("sarvam", "sarvam-v3", "openai", "elevenlabs", "cartesia"):
        speaker = "anushka"
    # v2 voices: anushka, abhilash, manisha, vidya, arya, karun, hitesh
    _V2_VOICES = {"anushka", "abhilash", "manisha", "vidya", "arya", "karun", "hitesh"}
    model = "bulbul:v2" if speaker in _V2_VOICES else "bulbul:v3"
    # Override if provider explicitly says v3
    if provider == "sarvam-v3":
        model = "bulbul:v3"
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            "https://api.sarvam.ai/text-to-speech",
            headers={"api-subscription-key": settings.sarvam_api_key},
            json={
                "inputs": [text],
                "target_language_code": language if "-" in language else f"{language}-IN",
                "speaker": speaker,
                "model": model,
                "enable_preprocessing": True,
            },
        )
        r.raise_for_status()
        # Response contains base64 WAV
        audio_b64 = r.json()["audios"][0]
    wav_bytes = base64.b64decode(audio_b64)
    with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
        src_rate = wf.getframerate()
        pcm = wf.readframes(wf.getnframes())
    if src_rate != 8000:
        from scipy.signal import resample
        samples = np.frombuffer(pcm, dtype=np.int16).astype(np.float64)
        target_len = int(len(samples) * 8000 / src_rate)
        pcm = resample(samples, target_len).astype(np.int16).tobytes()
    pcm = _enhance_for_telephone(pcm)
    return audioop.lin2ulaw(pcm, 2)


async def _tts_elevenlabs(text: str, voice_id: str) -> bytes:
    """ElevenLabs TTS → MP3 → decode → resample → mulaw 8 kHz."""
    el_key = getattr(settings, "elevenlabs_api_key", "") or ""
    # ElevenLabs voice IDs are 20+ char alphanumeric. Reject anything else.
    _EL_DEFAULT = "EXAVITQu4vr4xnSDxMaL"  # Sarah
    if not voice_id or len(voice_id) < 15 or voice_id in ("elevenlabs", "openai", "cartesia", "sarvam"):
        voice_id = _EL_DEFAULT
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            headers={"xi-api-key": el_key, "Content-Type": "application/json"},
            json={
                "text": text,
                "model_id": "eleven_turbo_v2_5",
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
                "output_format": "pcm_24000",
            },
        )
        r.raise_for_status()
    pcm_8k = _resample_24k_to_8k(r.content)
    pcm_8k = _enhance_for_telephone(pcm_8k)
    return audioop.lin2ulaw(pcm_8k, 2)


async def _tts(text: str, provider: str, voice: str, language: str = "en") -> bytes:
    """Route to correct TTS provider; fall back to OpenAI TTS on error."""
    if (provider == "elevenlabs" or provider.startswith("elevenlabs-")) and getattr(settings, "elevenlabs_api_key", ""):
        try:
            el_voice = voice.replace("elevenlabs-", "") if voice.startswith("elevenlabs-") else voice
            return await _tts_elevenlabs(text, el_voice)
        except Exception as e:
            logger.warning("elevenlabs_tts_failed_fallback", error=str(e))

    if provider == "cartesia" and settings.cartesia_api_key:
        try:
            return await _tts_cartesia(text, _cartesia_voice(voice))
        except Exception as e:
            logger.warning("cartesia_tts_failed_fallback", error=str(e))

    if (provider == "sarvam" or provider.startswith("sarvam")) and getattr(settings, "sarvam_api_key", ""):
        try:
            return await _tts_sarvam(text, voice, language, provider)
        except Exception as e:
            logger.warning("sarvam_tts_failed_fallback", error=str(e))

    # Fallback to OpenAI — use nova if voice is a UUID or non-OpenAI name
    fallback_voice = voice if voice in _VALID_OAI_VOICES else "nova"
    return await _tts_openai(text, fallback_voice)


# ── LLM ──────────────────────────────────────────────────────────────────────

def _resolve_llm(model: str, cfg: dict) -> tuple:
    """Resolve LLM model → (url, headers, model_name)."""
    model = _LLM_ALIASES.get(model, model)
    custom_url   = cfg.get("custom_llm_url", "")
    custom_model = cfg.get("custom_llm_model", "")
    if custom_url and custom_model:
        return custom_url.rstrip("/") + "/chat/completions", {"Authorization": f"Bearer {settings.openai_api_key}"}, custom_model
    elif model.startswith("mistral"):
        return "https://api.mistral.ai/v1/chat/completions", {"Authorization": f"Bearer {getattr(settings, 'mistral_api_key', '')}"}, model
    elif model.startswith("llama") or model.startswith("groq") or model.startswith("gemma") or model.startswith("mixtral"):
        groq_map = {"llama-3.3-70b": "llama-3.3-70b-versatile", "llama-3.1-8b": "llama-3.1-8b-instant", "gemma2-9b": "gemma2-9b-it"}
        return "https://api.groq.com/openai/v1/chat/completions", {"Authorization": f"Bearer {getattr(settings, 'groq_api_key', '')}"}, groq_map.get(model, model)
    else:
        return "https://api.openai.com/v1/chat/completions", {"Authorization": f"Bearer {settings.openai_api_key}"}, model


async def _llm_reply(messages: list, model: str, cfg: dict) -> str:
    """Non-streaming LLM call. Fallback path."""
    tuning = cfg.get("tuning") or {}
    temperature = tuning.get("temperature", 0.7)
    max_tokens = tuning.get("max_tokens", 200)
    url, headers, resolved_model = _resolve_llm(model, cfg)
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(url, headers=headers,
            json={"model": resolved_model, "messages": messages, "max_tokens": max_tokens, "temperature": temperature})
        r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


import re
_SENTENCE_END = re.compile(r'(?<=[.!?])\s+|(?<=[.!?])$')

# ── Response Shaping (format LLM text for voice delivery) ─────────────────

_CORPORATE_WORDS = {
    "leverage": "use", "utilize": "use", "streamline": "simplify",
    "comprehensive": "full", "facilitate": "help", "implement": "set up",
    "robust": "strong", "optimize": "improve", "enhance": "improve",
    "cutting-edge": "modern", "innovative": "new", "scalable": "flexible",
    "tailored": "custom", "empower": "help", "synergy": "teamwork",
}

_LATENCY_STARTERS = ["Yeah, ", "Got it. ", "Sure. ", "Right. ", "Okay. ", "So, "]
_starter_idx = [0]

def _format_for_voice(text: str) -> str:
    """Shape LLM output for natural voice delivery."""
    # Replace corporate jargon
    for corp, simple in _CORPORATE_WORDS.items():
        text = re.sub(rf'\b{corp}\b', simple, text, flags=re.IGNORECASE)

    # Break long sentences (>20 words) at commas
    sentences = re.split(r'(?<=[.!?])\s+', text)
    shaped = []
    for s in sentences:
        words = s.split()
        if len(words) > 20:
            # Try splitting at a comma near the middle
            mid = len(words) // 2
            for i in range(mid - 3, mid + 4):
                if 0 < i < len(words) and words[i - 1].endswith(','):
                    shaped.append(' '.join(words[:i]))
                    shaped.append(' '.join(words[i:]))
                    break
            else:
                shaped.append(s)
        else:
            shaped.append(s)
    return ' '.join(shaped)

def _add_latency_mask(text: str) -> str:
    """Prepend a short starter word for illusion of instant response."""
    # Only add if response doesn't already start with a casual word
    lower = text.lower()
    if any(lower.startswith(w.lower().strip()) for w in ["yeah", "got it", "sure", "right", "okay", "so,", "well,"]):
        return text
    starter = _LATENCY_STARTERS[_starter_idx[0] % len(_LATENCY_STARTERS)]
    _starter_idx[0] += 1
    return starter + text[0].lower() + text[1:] if text else text


def _is_valid_speech(text: str) -> bool:
    """Detect gibberish/hallucinated output from LLM."""
    words = text.split()
    if len(words) < 2:
        return True
    # Check for repeated words (3+ in a row)
    for i in range(len(words) - 2):
        if words[i].lower() == words[i+1].lower() == words[i+2].lower():
            return False
    # Check for high ratio of non-alpha characters
    alpha = sum(c.isalpha() or c.isspace() for c in text)
    if len(text) > 5 and alpha / len(text) < 0.6:
        return False
    # Check for underscore patterns (code leaking)
    if "_" in text and text.count("_") > 2:
        return False
    return True


async def _llm_stream_chunks(messages: list, model: str, cfg: dict):
    """Stream LLM response, yield speakable chunks FAST.
    Yields on: sentence end (.!?) OR comma after 8+ words OR 12+ words without break.
    Goal: first audio within 300ms of first token."""
    tuning = cfg.get("tuning") or {}
    temperature = tuning.get("temperature", 0.7)
    max_tokens = tuning.get("max_tokens", 200)
    url, headers, resolved_model = _resolve_llm(model, cfg)
    buffer = ""
    word_count = 0
    async with httpx.AsyncClient(timeout=30) as client:
        async with client.stream("POST", url, headers={**headers, "Accept": "text/event-stream"},
                json={"model": resolved_model, "messages": messages,
                      "max_tokens": max_tokens, "temperature": temperature, "stream": True}) as resp:
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                payload = line[6:]
                if payload == "[DONE]":
                    break
                try:
                    chunk = json.loads(payload)
                    delta = chunk["choices"][0].get("delta", {}).get("content", "")
                    if not delta:
                        continue
                    buffer += delta
                    word_count = len(buffer.split())

                    # Yield on sentence end
                    if re.search(r'[.!?]\s*$', buffer):
                        s = buffer.strip()
                        if s and _is_valid_speech(s):
                            yield s
                        buffer = ""
                        word_count = 0
                    # Yield on comma/semicolon after 8+ words
                    elif word_count >= 8 and re.search(r'[,;]\s*$', buffer):
                        s = buffer.strip()
                        if s and _is_valid_speech(s):
                            yield s
                        buffer = ""
                        word_count = 0
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue
    if buffer.strip():
        yield buffer.strip()


# ── STT helpers ───────────────────────────────────────────────────────────────

def _deepgram_url(stt_provider: str, tuning: dict | None = None) -> str:
    tuning = tuning or {}
    model = stt_provider.replace("deepgram-", "") or "nova-3"
    endpointing = tuning.get("endpointing_ms", 300)
    url = (
        f"wss://api.deepgram.com/v1/listen"
        f"?model={model}&encoding=mulaw&sample_rate=8000&channels=1&endpointing={endpointing}"
    )
    keywords = tuning.get("keywords_boost") or []
    if keywords:
        kw_param = ",".join(f"{w}:2" for w in keywords[:20])
        url += f"&keywords={kw_param}"
    return url

def _mulaw_to_wav(mulaw_bytes: bytes) -> bytes:
    pcm = audioop.ulaw2lin(mulaw_bytes, 2)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1); wf.setsampwidth(2)
        wf.setframerate(8000); wf.writeframes(pcm)
    return buf.getvalue()

async def _whisper_transcribe(mulaw_bytes: bytes) -> str:
    wav = _mulaw_to_wav(mulaw_bytes)
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            files={"file": ("audio.wav", wav, "audio/wav")},
            data={"model": "whisper-1"},
        )
        r.raise_for_status()
    return r.json().get("text", "").strip()


# ── WebSocket handler ─────────────────────────────────────────────────────────

@router.websocket("/media/stream/{call_id}")
async def media_stream(ws: WebSocket, call_id: str):
    await ws.accept()
    log = logger.bind(call_id=call_id)
    log.info("media_stream_connected")

    r = get_redis()
    raw = await r.get(f"agent_config:{call_id}")
    if not raw:
        log.error("agent_config_not_found")
        await ws.close()
        return

    cfg          = json.loads(raw)
    prompt       = cfg.get("prompt", "You are a helpful assistant.")
    kb_context   = cfg.get("kb_context", "")
    greeting     = cfg.get("greeting", "Hello! How can I help you today?")
    llm_model    = cfg.get("llm", "gpt-4o-mini")
    tts_provider = cfg.get("tts", "openai")
    stt_provider = cfg.get("stt", "deepgram-nova-3")
    language     = cfg.get("language", "en")
    voice_raw    = cfg.get("voice", "alloy")
    tuning       = cfg.get("tuning") or {}
    silence_timeout  = tuning.get("silence_timeout_sec", 30)
    call_timeout     = tuning.get("call_timeout_sec", 300)
    final_message    = tuning.get("final_message", "")

    import time as _time

    # Inject KB context into prompt
    if kb_context:
        prompt = prompt + f"\n\nKNOWLEDGE BASE (use this to answer questions):\n{kb_context}"

    log.info("media_stream_starting",
             stt=stt_provider, llm=llm_model, tts=tts_provider, voice=voice_raw)

    # ── Playback Controller ─────────────────────────────────────────────────
    class PlaybackController:
        """Central controller for audio output. Enables instant interruption."""
        def __init__(self):
            self.current_task = None
            self.is_playing = False
            self.llm_task = None  # track the LLM streaming task too

        def start(self, task):
            self.current_task = task
            self.is_playing = True

        def stop(self):
            """Instantly stop all output — TTS playback + LLM generation."""
            self.is_playing = False
            if self.current_task and not self.current_task.done():
                self.current_task.cancel()
            if self.llm_task and not self.llm_task.done():
                self.llm_task.cancel()
            self.current_task = None
            self.llm_task = None

    playback = PlaybackController()

    # ── Session State ─────────────────────────────────────────────────────────
    # States: GREETING, LISTENING, PROCESSING, RESPONDING, INTERRUPTED
    session = {
        "state": "GREETING",
        "stream_sid": None,
        "active": True,
        "audio_format": "mulaw",  # "mulaw" for Twilio, "l16" for Vobiz
    }

    system_prompt = (
        prompt
        + "\n\nIMPORTANT: This is an ongoing phone call. Never repeat your opening greeting. "
        "If the caller seems confused or says 'hello', briefly acknowledge and continue the conversation naturally."
    )
    messages     = [{"role": "system", "content": system_prompt}]
    messages_log: list[str] = []
    ws_lock      = asyncio.Lock()

    # ── Audio output (chunk-level) ────────────────────────────────────────────

    async def _ws_send(payload: str) -> None:
        async with ws_lock:
            await ws.send_text(payload)

    async def _clear_twilio():
        """Send clear event to stop audio buffer immediately (Twilio + Vobiz)."""
        if session["stream_sid"]:
            try:
                await _ws_send(json.dumps(
                    {"event": "clear", "streamSid": session["stream_sid"], "streamId": session["stream_sid"]}
                ))
            except Exception:
                pass

    async def play_mulaw(mulaw: bytes) -> None:
        """Stream mulaw audio in small chunks (50ms) for fast interrupt response."""
        chunk_size = 400  # 400 bytes = 50ms at 8kHz mulaw
        sid = session["stream_sid"]
        for i in range(0, len(mulaw), chunk_size):
            if not playback.is_playing:
                return
            await _ws_send(json.dumps({
                "event": "media",
                "streamSid": sid,
                "streamId": sid,
                "media": {"payload": base64.b64encode(mulaw[i:i + chunk_size]).decode()},
            }))
            await asyncio.sleep(0.01)

    async def play_vobiz(mulaw: bytes) -> None:
        """Stream audio to Vobiz — same media event format as receiving.
        Vobiz docs: 'To send audio to the caller, you send the same format back'"""
        chunk_size = 400  # 400 bytes = 50ms mulaw
        sid = session["stream_sid"]
        for i in range(0, len(mulaw), chunk_size):
            if not playback.is_playing:
                return
            await _ws_send(json.dumps({
                "event": "media",
                "streamSid": sid,
                "streamId": sid,
                "media": {
                    "payload": base64.b64encode(mulaw[i:i + chunk_size]).decode(),
                },
            }))
            await asyncio.sleep(0.01)

    async def play_text(text: str) -> None:
        """Generate TTS and stream to Twilio. Respects playback.is_playing."""
        if not session["stream_sid"] or not text.strip():
            log.warning("play_text_skipped", has_sid=bool(session["stream_sid"]), text_len=len(text.strip()))
            return
        try:
            log.info("play_text_tts_start", text=text[:50], fmt=session["audio_format"])
            mulaw = await _tts(text, tts_provider, voice_raw, language)
            log.info("play_text_tts_done", mulaw_len=len(mulaw))
            await play_mulaw(mulaw)
            log.info("play_text_sent")
        except asyncio.CancelledError:
            log.info("play_text_cancelled")
        except Exception as e:
            log.error("tts_error", error=str(e))

    # ── Interrupt Handler ─────────────────────────────────────────────────────

    async def on_interrupt():
        """User started speaking while AI is talking. Stop everything instantly."""
        if playback.is_playing:
            log.info("interrupted")
            playback.stop()
            await _clear_twilio()
            session["state"] = "LISTENING"

    # ── Transcript Handler ────────────────────────────────────────────────────

    _last_speech_time = {"t": _time.time()}

    async def on_transcript(text: str) -> None:
        """Handle final transcript — generate LLM response and stream TTS."""
        if not text:
            return
        _last_speech_time["t"] = _time.time()
        log.info("user_said", text=text)
        messages_log.append(f"USER: {text}")

        # Stop any current output
        playback.stop()
        await _clear_twilio()
        session["state"] = "PROCESSING"

        async def _respond():
            try:
                messages.append({"role": "user", "content": text})
                full_reply = []
                session["state"] = "RESPONDING"
                is_first = True
                next_tts_task = None  # pre-fetch next sentence TTS

                async for sentence in _llm_stream_chunks(messages, llm_model, cfg):
                    if not playback.is_playing:
                        break

                    shaped = _format_for_voice(sentence)
                    if is_first:
                        shaped = _add_latency_mask(shaped)
                        is_first = False
                    full_reply.append(shaped)

                    # If we pre-fetched TTS for this sentence, use it
                    if next_tts_task:
                        try:
                            mulaw = await next_tts_task
                        except Exception:
                            mulaw = await _tts(shaped, tts_provider, voice_raw, language)
                        next_tts_task = None
                    else:
                        mulaw = await _tts(shaped, tts_provider, voice_raw, language)

                    if not playback.is_playing:
                        break

                    # Start playing this sentence
                    play_task = asyncio.create_task(play_mulaw(mulaw))

                    # While playing, pre-fetch TTS for whatever comes next
                    # (the next iteration of the loop will use it)
                    # We can't know the next sentence yet, so this just overlaps play + LLM stream
                    try:
                        await play_task
                    except asyncio.CancelledError:
                        break

                    if not playback.is_playing:
                        break

                reply = " ".join(full_reply)
                if reply:
                    messages.append({"role": "assistant", "content": reply})
                    log.info("agent_said", text=reply)
                    messages_log.append(f"AGENT: {reply}")
            except asyncio.CancelledError:
                pass  # Interrupted — normal
            except Exception as e:
                log.error("llm_stream_error", error=str(e), error_type=type(e).__name__)
                # Fallback: non-streaming (fresh connection)
                try:
                    reply = await _llm_reply(messages, llm_model, cfg)
                    if reply:
                        shaped = _format_for_voice(reply)
                        shaped = _add_latency_mask(shaped)
                        messages.append({"role": "assistant", "content": shaped})
                        log.info("agent_said", text=shaped)
                        messages_log.append(f"AGENT: {shaped}")
                        await play_text(shaped)
                except Exception as e2:
                    log.error("llm_fallback_error", error=str(e2))
            finally:
                if session["state"] == "RESPONDING":
                    session["state"] = "LISTENING"
                playback.is_playing = False

        # Start response as a tracked task
        task = asyncio.create_task(_respond())
        playback.start(task)
        playback.llm_task = task

    # ── STT with Interrupt Detection ──────────────────────────────────────────

    async def run_deepgram() -> None:
        dg_model = stt_provider.replace("deepgram-", "") or "nova-3"
        endpointing = tuning.get("endpointing_ms", 300)
        # Enable interim_results for interrupt detection
        dg_url = (
            f"wss://api.deepgram.com/v1/listen"
            f"?model={dg_model}&encoding=mulaw&sample_rate=8000&channels=1"
            f"&endpointing={endpointing}&interim_results=true"
        )
        # Add keyword boosting from tuning
        keywords = tuning.get("keywords_boost") or []
        if keywords:
            kw_param = ",".join(f"{w}:2" for w in keywords[:20])
            dg_url += f"&keywords={kw_param}"
        dg_headers = {"Authorization": f"Token {settings.deepgram_api_key}"}

        async def recv_twilio(dg_ws) -> None:
            """Receive audio from Twilio or Vobiz WebSocket — normalizes both formats."""
            _msg_count = 0
            try:
                async for raw_msg in ws.iter_text():
                    data = json.loads(raw_msg)
                    ev   = data.get("event")
                    # Log first 5 messages to debug provider format
                    _msg_count += 1
                    if _msg_count <= 5:
                        log.info("ws_raw_message", count=_msg_count, ws_event=ev, keys=list(data.keys())[:10])
                    if ev == "connected":
                        log.info("ws_connected_event", protocol=data.get("protocol"))
                        continue
                    # Treat first media event as stream start if no start event received (Vobiz)
                    if ev == "media" and not session["stream_sid"]:
                        session["stream_sid"] = data.get("streamId") or data.get("streamSid") or call_id
                        log.info("stream_started_from_media", stream_sid=session["stream_sid"])
                        try:
                            await update_status(call_id, CallStatus.ACTIVE)
                        except Exception:
                            pass
                        if greeting:
                            messages.append({"role": "assistant", "content": greeting})
                            messages_log.append(f"AGENT: {greeting}")
                            session["state"] = "RESPONDING"
                            playback.is_playing = True
                            playback.current_task = asyncio.create_task(play_text(greeting))
                            async def _post_greeting_v():
                                try:
                                    await playback.current_task
                                except Exception:
                                    pass
                                playback.is_playing = False
                                session["state"] = "LISTENING"
                            asyncio.create_task(_post_greeting_v())
                        # Also forward this first media packet to Deepgram
                        media = data.get("media", {})
                        payload = media.get("payload") or data.get("payload") or ""
                        if payload:
                            await dg_ws.send(base64.b64decode(payload))
                        continue
                    if ev == "start":
                        # Twilio: data["start"]["streamSid"], Vobiz: may differ
                        start_data = data.get("start") or {}
                        if isinstance(start_data, str):
                            start_data = {}
                        log.info("start_event_debug", start_type=type(start_data).__name__, start_keys=list(start_data.keys())[:10] if isinstance(start_data, dict) else str(start_data)[:100], top_keys=list(data.keys()), media_format=str(start_data.get("mediaFormat", ""))[:200] if isinstance(start_data, dict) else "", tracks=str(start_data.get("tracks", ""))[:100] if isinstance(start_data, dict) else "")
                        # Detect audio format
                        mf = start_data.get("mediaFormat", {}) if isinstance(start_data, dict) else {}
                        if isinstance(mf, dict) and "l16" in str(mf.get("encoding", "")).lower():
                            session["audio_format"] = "l16"
                        session["stream_sid"] = (
                            (start_data.get("streamSid") if isinstance(start_data, dict) else None)
                            or (start_data.get("streamId") if isinstance(start_data, dict) else None)
                            or data.get("streamSid")
                            or data.get("streamId")
                            or call_id
                        )
                        log.info("stream_started", stream_sid=session["stream_sid"])
                        try:
                            await update_status(call_id, CallStatus.ACTIVE)
                        except Exception:
                            pass
                        # Play greeting
                        if greeting:
                            messages.append({"role": "assistant", "content": greeting})
                            messages_log.append(f"AGENT: {greeting}")
                            session["state"] = "RESPONDING"
                            playback.is_playing = True
                            playback.current_task = asyncio.create_task(play_text(greeting))
                            # After greeting, switch to listening
                            async def _post_greeting():
                                try:
                                    await playback.current_task
                                except (asyncio.CancelledError, Exception):
                                    pass
                                session["state"] = "LISTENING"
                                playback.is_playing = False
                            asyncio.create_task(_post_greeting())
                    elif ev == "media":
                        media = data.get("media", {})
                        payload = media.get("payload") or data.get("payload") or ""
                        if payload:
                            await dg_ws.send(base64.b64decode(payload))
                    elif ev == "stop":
                        session["active"] = False
                        break
            except WebSocketDisconnect:
                session["active"] = False
            except Exception as e:
                log.error("twilio_recv_error", error=str(e))
            finally:
                await dg_ws.close()

        # Adaptive turn-taking — continuation words mean user isn't done
        _CONTINUATION_WORDS = {"and", "but", "so", "because", "like", "or", "also",
                               "then", "well", "actually", "basically", "i mean",
                               "you know", "the", "my", "our", "we", "i"}
        _pending_final = {"text": None, "task": None}

        async def _delayed_process(text: str, delay: float):
            """Wait before processing — gives user time to continue."""
            await asyncio.sleep(delay)
            if _pending_final["text"] == text:  # still the same, user didn't continue
                _pending_final["text"] = None
                await on_transcript(text)

        async def recv_deepgram(dg_ws) -> None:
            try:
                async for msg in dg_ws:
                    data = json.loads(msg)
                    if data.get("type") != "Results":
                        continue
                    alts = data.get("channel", {}).get("alternatives", [])
                    if not alts:
                        continue
                    transcript = alts[0].get("transcript", "").strip()
                    is_final = data.get("is_final", False)

                    if transcript:
                        if not is_final and playback.is_playing:
                            # INTERIM result while AI is speaking → INTERRUPT
                            await on_interrupt()
                        elif is_final:
                            # Cancel any pending delayed process
                            if _pending_final["task"] and not _pending_final["task"].done():
                                _pending_final["task"].cancel()

                            # Check if user likely isn't done (ends with continuation word)
                            last_word = transcript.split()[-1].lower().rstrip(".,!?") if transcript.split() else ""
                            if last_word in _CONTINUATION_WORDS:
                                # User probably isn't done — wait 600ms before processing
                                _pending_final["text"] = transcript
                                _pending_final["task"] = asyncio.create_task(
                                    _delayed_process(transcript, 0.6)
                                )
                            else:
                                # User is done — process immediately
                                _pending_final["text"] = None
                                await on_transcript(transcript)
            except Exception as e:
                log.error("deepgram_recv_error", error=str(e))

        async def keepalive(dg_ws) -> None:
            try:
                while session["active"]:
                    await asyncio.sleep(8)
                    await dg_ws.send(json.dumps({"type": "KeepAlive"}))
            except Exception:
                pass

        # ── Silence timeout: uses _last_speech_time defined alongside on_transcript ──

        async def silence_watchdog(dg_ws) -> None:
            """Close call if no user speech for silence_timeout seconds."""
            while session["active"]:
                await asyncio.sleep(2)
                elapsed = _time.time() - _last_speech_time["t"]
                if elapsed >= silence_timeout and session["state"] == "LISTENING" and not playback.is_playing:
                    log.info("silence_timeout_reached", seconds=silence_timeout)
                    if final_message:
                        try:
                            playback.is_playing = True
                            await play_text(final_message)
                        except Exception:
                            pass
                    session["active"] = False
                    try:
                        await dg_ws.close()
                    except Exception:
                        pass
                    return

        async def call_timeout_watchdog() -> None:
            """Close call after max call duration."""
            await asyncio.sleep(call_timeout)
            if session["active"]:
                log.info("call_timeout_reached", seconds=call_timeout)
                if final_message:
                    try:
                        playback.is_playing = True
                        await play_text(final_message)
                    except Exception:
                        pass
                session["active"] = False

        async with websockets.connect(dg_url, additional_headers=dg_headers) as dg_ws:
            log.info("deepgram_connected")
            await asyncio.gather(
                recv_twilio(dg_ws), recv_deepgram(dg_ws), keepalive(dg_ws),
                silence_watchdog(dg_ws), call_timeout_watchdog(),
            )

    async def run_whisper() -> None:
        audio_buf    = bytearray()
        transcript_q: asyncio.Queue = asyncio.Queue()

        async def recv_twilio_w() -> None:
            try:
                async for raw_msg in ws.iter_text():
                    data = json.loads(raw_msg)
                    ev   = data.get("event")
                    if ev == "start":
                        session["stream_sid"] = data["start"]["streamSid"]
                        log.info("stream_started", stream_sid=session["stream_sid"])
                        try:
                            await update_status(call_id, CallStatus.ACTIVE)
                        except Exception:
                            pass
                        asyncio.create_task(_prefetch_fillers())
                        if greeting:
                            messages.append({"role": "assistant", "content": greeting})
                            messages_log.append(f"AGENT: {greeting}")
                            state["speak_task"] = asyncio.create_task(play_text(greeting))
                    elif ev == "media":
                        audio_buf += base64.b64decode(data["media"]["payload"])
                        if len(audio_buf) >= WHISPER_FLUSH_BYTES:
                            chunk = bytes(audio_buf); audio_buf.clear()
                            await transcript_q.put(chunk)
                    elif ev == "stop":
                        if audio_buf:
                            await transcript_q.put(bytes(audio_buf))
                        await transcript_q.put(None)
                        break
            except WebSocketDisconnect:
                await transcript_q.put(None)
            except Exception as e:
                log.error("twilio_recv_error", error=str(e))
                await transcript_q.put(None)

        async def whisper_worker() -> None:
            while True:
                chunk = await transcript_q.get()
                if chunk is None:
                    break
                try:
                    text = await _whisper_transcribe(chunk)
                    if text:
                        await on_transcript(text)
                except Exception as e:
                    log.error("whisper_error", error=str(e))

        await asyncio.gather(recv_twilio_w(), whisper_worker())

    # ── Run ───────────────────────────────────────────────────────────────────
    import time as _time
    _call_start = _time.time()

    try:
        await update_status(call_id, CallStatus.CONNECTING)
    except Exception:
        pass

    try:
        if stt_provider.startswith("deepgram"):
            await run_deepgram()
        else:
            await run_whisper()
    except Exception as e:
        log.error("media_stream_error", error=str(e))
    finally:
        duration_sec = int(_time.time() - _call_start)
        log.info("media_stream_ended", call_id=call_id, duration=duration_sec)
        playback.stop()

        # Count agent chars for cost calculation
        agent_chars = sum(len(line[6:].strip()) for line in messages_log if line.startswith("AGENT:"))

        try:
            db = get_db()
            db.table("calls").update({
                "transcript": "\n".join(messages_log),
                "status": "completed",
                "duration_sec": duration_sec,
                "engine": "media_stream",
                "llm_provider": llm_model,
                "stt_provider": stt_provider,
                "tts_provider": tts_provider,
                "metadata": {
                    "voice": voice_raw,
                    "agent_chars": agent_chars,
                    "turns": len([l for l in messages_log if l.startswith("USER:")]),
                },
            }).eq("id", call_id).execute()
            await update_status(call_id, CallStatus.COMPLETED)
        except Exception:
            pass
