"""
FillerSystem — speculative filler injection.

How it works:
  1. On user_speech_committed: start 200ms async timer
  2. If agent starts speaking before 200ms → cancel timer (LLM was fast)
  3. If 200ms expires with no agent response → inject a filler phrase via session.say()
  4. session.say() will be interrupted cleanly by the real response when it arrives

Filler phrases are lightweight text (not pre-cached audio) because the LiveKit
Agents SDK manages TTS synthesis internally. The speculative timer prevents
the filler from firing on fast queries while covering slow LLM spikes.
"""
import asyncio
import random


FILLERS: dict[str, list[str]] = {
    "en": [
        "Sure, one moment.",
        "Let me check that for you.",
        "One second.",
        "Good question, let me think.",
    ],
    "hi": [
        "एक पल रुकिए।",
        "देखते हैं।",
        "ठीक है, एक क्षण।",
    ],
    "multi": [
        "Sure, ek second.",
        "Let me check — ek moment.",
        "Dekhte hain.",
    ],
}


class FillerSystem:
    """
    Tracks whether agent is speaking and fires speculative fillers.

    Usage:
        filler = FillerSystem(session, language="en", delay_ms=200)
        # Register hooks on the session after calling this
    """

    def __init__(self, session, language: str = "en", delay_ms: int = 200):
        self._session = session
        self._lang = language if language in FILLERS else "en"
        self._delay = delay_ms / 1000.0
        self._timer_task: asyncio.Task | None = None
        self._agent_speaking = False
        self._enabled = True

    def set_language(self, lang: str) -> None:
        self._lang = lang if lang in FILLERS else "en"

    def on_agent_started(self) -> None:
        """Call when agent begins speaking — cancels pending filler timer."""
        self._agent_speaking = True
        if self._timer_task and not self._timer_task.done():
            self._timer_task.cancel()

    def on_agent_stopped(self) -> None:
        self._agent_speaking = False

    def on_user_speech(self) -> None:
        """Call when user speech is committed — starts speculative timer."""
        self._agent_speaking = False
        if self._timer_task and not self._timer_task.done():
            self._timer_task.cancel()
        if self._enabled:
            self._timer_task = asyncio.create_task(self._speculative_fire())

    async def _speculative_fire(self) -> None:
        try:
            await asyncio.sleep(self._delay)
            if not self._agent_speaking:
                phrase = random.choice(FILLERS.get(self._lang, FILLERS["en"]))
                try:
                    await self._session.say(phrase, add_to_chat_ctx=False)
                except Exception:
                    pass   # SDK version may not support add_to_chat_ctx
        except asyncio.CancelledError:
            pass   # timer cancelled because agent responded fast
