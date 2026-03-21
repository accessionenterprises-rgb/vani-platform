"""
Call limits and silence recovery.

Enforces:
  - MAX_TURNS: agent says fallback + ends gracefully after N turns
  - MAX_DURATION: enforced by agent.py wait_for (900s)
  - SILENCE_WARN: "Are you still there?" at 5s of silence
  - SILENCE_END: graceful hangup at 8s of silence
"""
import asyncio


MAX_TURNS = 50
SILENCE_WARN_SEC = 5
SILENCE_END_SEC = 8

SILENCE_WARN_TEXT = {
    "en": "Are you still there?",
    "hi": "क्या आप अभी भी वहाँ हैं?",
    "multi": "Are you still there? Kya aap hain?",
}
SILENCE_END_TEXT = {
    "en": "I didn't hear anything. Goodbye, have a great day!",
    "hi": "मुझे कुछ सुनाई नहीं दिया। धन्यवाद, अलविदा!",
    "multi": "I didn't hear you. Goodbye!",
}
TURNS_EXCEEDED_TEXT = {
    "en": "We've had a long conversation! Let me connect you with our team for further assistance. Goodbye!",
    "hi": "हमने काफी बात की! मैं आपको हमारी टीम से जोड़ता हूँ। धन्यवाद!",
    "multi": "Long conversation! Let me transfer you. Goodbye!",
}


class CallLimits:
    """
    Tracks turn count and silence timer.
    Integrate with session events and call session.say() + disconnect.
    """

    def __init__(self, session, language: str = "en"):
        self._session = session
        self._lang = language if language in SILENCE_WARN_TEXT else "en"
        self._turn_count = 0
        self._silence_task: asyncio.Task | None = None
        self._disconnected = False

    def set_language(self, lang: str) -> None:
        self._lang = lang if lang in SILENCE_WARN_TEXT else "en"

    @property
    def turn_count(self) -> int:
        return self._turn_count

    def on_user_speech(self) -> bool:
        """
        Call when user speech is committed.
        Returns True if call should continue, False if max turns exceeded.
        """
        self._cancel_silence_timer()
        self._turn_count += 1
        if self._turn_count > MAX_TURNS:
            asyncio.create_task(self._end_max_turns())
            return False
        return True

    def on_agent_stopped(self) -> None:
        """Call when agent finishes speaking — start silence timer."""
        self._start_silence_timer()

    def on_user_activity(self) -> None:
        """Call on any user activity (interim transcript) — reset silence timer."""
        self._cancel_silence_timer()

    def _start_silence_timer(self) -> None:
        self._cancel_silence_timer()
        if not self._disconnected:
            self._silence_task = asyncio.create_task(self._silence_handler())

    def _cancel_silence_timer(self) -> None:
        if self._silence_task and not self._silence_task.done():
            self._silence_task.cancel()

    async def _silence_handler(self) -> None:
        try:
            await asyncio.sleep(SILENCE_WARN_SEC)
            if not self._disconnected:
                await self._session.say(SILENCE_WARN_TEXT[self._lang], add_to_chat_ctx=False)
            await asyncio.sleep(SILENCE_END_SEC - SILENCE_WARN_SEC)
            if not self._disconnected:
                await self._session.say(SILENCE_END_TEXT[self._lang], add_to_chat_ctx=False)
                await asyncio.sleep(1.5)
                await self._disconnect()
        except asyncio.CancelledError:
            pass

    async def _end_max_turns(self) -> None:
        try:
            await self._session.say(TURNS_EXCEEDED_TEXT[self._lang], add_to_chat_ctx=False)
            await asyncio.sleep(2)
            await self._disconnect()
        except Exception:
            pass

    async def _disconnect(self) -> None:
        if self._disconnected:
            return
        self._disconnected = True
        try:
            await self._session.aclose()
        except Exception:
            pass
