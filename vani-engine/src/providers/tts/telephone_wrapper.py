"""
TTS wrapper that preprocesses audio for telephone output.

Wraps any LiveKit TTS plugin and applies audio optimization
before the audio enters the LiveKit room → SIP pipeline.

Usage:
    tts = openai.TTS(voice="nova")
    tts = TelephoneTTS(tts)  # wraps it
    session = AgentSession(stt=stt, llm=llm, tts=tts)  # use normally
"""
from livekit.agents.tts import TTS, SynthesizedAudio, SynthesizeStream, ChunkedStream
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS
from audio_preprocess import preprocess_for_telephone


class TelephoneTTS(TTS):
    """Wraps a TTS provider and applies telephone audio preprocessing."""

    def __init__(self, inner_tts: TTS):
        super().__init__(
            capabilities=inner_tts.capabilities,
            sample_rate=inner_tts.sample_rate,
            num_channels=inner_tts.num_channels,
        )
        self._inner = inner_tts

    def synthesize(self, text: str, *, conn_options=DEFAULT_API_CONNECT_OPTIONS) -> ChunkedStream:
        inner_stream = self._inner.synthesize(text, conn_options=conn_options)
        return _ProcessedChunkedStream(inner_stream, self._inner.sample_rate)

    def stream(self, *, conn_options=DEFAULT_API_CONNECT_OPTIONS) -> SynthesizeStream:
        inner_stream = self._inner.stream(conn_options=conn_options)
        return _ProcessedSynthStream(inner_stream, self._inner.sample_rate)


class _ProcessedChunkedStream(ChunkedStream):
    """Wraps a ChunkedStream and processes each audio chunk."""

    def __init__(self, inner: ChunkedStream, sample_rate: int):
        self._inner = inner
        self._sample_rate = sample_rate

    async def __anext__(self) -> SynthesizedAudio:
        audio = await self._inner.__anext__()
        if audio.data:
            audio = SynthesizedAudio(
                text=audio.text,
                data=preprocess_for_telephone(audio.data, self._sample_rate),
                sample_rate=audio.sample_rate,
                num_channels=audio.num_channels,
            )
        return audio

    def __aiter__(self):
        return self

    async def aclose(self):
        await self._inner.aclose()

    async def __aenter__(self):
        await self._inner.__aenter__()
        return self

    async def __aexit__(self, *args):
        await self._inner.__aexit__(*args)


class _ProcessedSynthStream(SynthesizeStream):
    """Wraps a SynthesizeStream and processes each audio chunk."""

    def __init__(self, inner: SynthesizeStream, sample_rate: int):
        self._inner = inner
        self._sample_rate = sample_rate

    def push_text(self, text: str):
        self._inner.push_text(text)

    def flush(self):
        self._inner.flush()

    def end_input(self):
        self._inner.end_input()

    async def __anext__(self) -> SynthesizedAudio:
        audio = await self._inner.__anext__()
        if audio.data:
            audio = SynthesizedAudio(
                text=audio.text,
                data=preprocess_for_telephone(audio.data, self._sample_rate),
                sample_rate=audio.sample_rate,
                num_channels=audio.num_channels,
            )
        return audio

    def __aiter__(self):
        return self

    async def aclose(self):
        await self._inner.aclose()

    async def __aenter__(self):
        await self._inner.__aenter__()
        return self

    async def __aexit__(self, *args):
        await self._inner.__aexit__(*args)
