"""
Circuit breaker for STT / LLM / TTS providers.

In-memory per engine process. Each engine worker independently tracks
provider health — sufficient for V1 (no cross-worker sync needed).

Auto-fallback: when a provider is OPEN, resolve() returns its fallback
so the next call uses a working provider without manual intervention.

Usage:
    # On provider build:
    model = circuit_breaker.resolve(requested_model)

    # After success:
    circuit_breaker.record_success(model)

    # After failure:
    circuit_breaker.record_failure(model)
"""

import time
from threading import Lock

# ── Thresholds ─────────────────────────────────────────────────────────────────
FAILURE_THRESHOLD = 3       # consecutive failures before OPEN
RECOVERY_SEC      = 30      # seconds OPEN before trying HALF_OPEN

# ── Fallback map ───────────────────────────────────────────────────────────────
# Primary provider → fallback provider
FALLBACKS: dict[str, str] = {
    # LLM
    "gpt-4o-mini":           "gemini-2.0-flash",
    "gpt-4o":                "gpt-4o-mini",
    "gemini-2.0-flash":      "gpt-4o-mini",
    "gemini-flash-lite":     "gpt-4o-mini",
    "gemini-2.0-flash-lite": "gemini-2.0-flash",
    "claude-haiku":          "gpt-4o-mini",
    "claude-haiku-4-5-20251001": "gpt-4o-mini",
    "groq":                  "gpt-4o-mini",
    "llama":                 "gpt-4o-mini",

    # STT
    "deepgram-nova-3":       "deepgram-nova-2",
    "deepgram-nova-2":       "deepgram-nova-3",

    # TTS
    "sarvam":                "openai-nova",
    "cartesia":              "openai-nova",
    "elevenlabs":            "openai-nova",
    "openai-nova":           "openai-shimmer",
    "openai-shimmer":        "openai-alloy",
}


# ── Internal state ─────────────────────────────────────────────────────────────

class _State:
    __slots__ = ("state", "failures", "last_failure", "lock")

    def __init__(self):
        self.state        = "CLOSED"   # CLOSED | OPEN | HALF_OPEN
        self.failures     = 0
        self.last_failure = 0.0
        self.lock         = Lock()


_registry: dict[str, _State] = {}
_registry_lock = Lock()


def _get(provider: str) -> _State:
    key = provider.lower()
    with _registry_lock:
        if key not in _registry:
            _registry[key] = _State()
        return _registry[key]


# ── Public API ─────────────────────────────────────────────────────────────────

def is_available(provider: str) -> bool:
    """Return True if this provider should be tried (CLOSED or HALF_OPEN test)."""
    b = _get(provider)
    with b.lock:
        if b.state == "CLOSED":
            return True
        if b.state == "OPEN":
            if time.monotonic() - b.last_failure >= RECOVERY_SEC:
                b.state = "HALF_OPEN"
                print(f">>> [CB] HALF_OPEN: {provider} — testing recovery", flush=True)
                return True
            return False
        # HALF_OPEN: allow the one test request
        return True


def record_failure(provider: str) -> None:
    """Call after a provider throws an error."""
    b = _get(provider)
    with b.lock:
        b.failures     += 1
        b.last_failure  = time.monotonic()
        if b.failures >= FAILURE_THRESHOLD and b.state != "OPEN":
            b.state = "OPEN"
            print(f">>> [CB] OPEN: {provider} (failures={b.failures})", flush=True)
        else:
            print(f">>> [CB] failure recorded: {provider} ({b.failures}/{FAILURE_THRESHOLD})",
                  flush=True)


def record_success(provider: str) -> None:
    """Call after a provider succeeds (especially during HALF_OPEN)."""
    b = _get(provider)
    with b.lock:
        was_degraded = b.state in ("OPEN", "HALF_OPEN")
        b.state        = "CLOSED"
        b.failures     = 0
        b.last_failure = 0.0
        if was_degraded:
            print(f">>> [CB] CLOSED: {provider} (recovered)", flush=True)


def resolve(provider: str) -> str:
    """Return the provider to actually use — fallback if primary is OPEN."""
    if is_available(provider):
        return provider
    fallback = FALLBACKS.get(provider.lower())
    if fallback and is_available(fallback):
        print(f">>> [CB] {provider} OPEN → using fallback: {fallback}", flush=True)
        return fallback
    # No fallback available — force primary anyway (better than silence)
    print(f">>> [CB] {provider} OPEN + no fallback, forcing anyway", flush=True)
    return provider


def status() -> dict[str, dict]:
    """Return current state of all tracked providers (for health endpoint)."""
    out = {}
    with _registry_lock:
        for k, v in _registry.items():
            with v.lock:
                out[k] = {"state": v.state, "failures": v.failures}
    return out
