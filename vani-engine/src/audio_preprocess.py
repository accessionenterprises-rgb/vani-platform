"""
Audio preprocessing for telephone output.

When TTS generates 24kHz audio but the caller hears 8kHz G.711,
naive downsampling loses quality. This module optimizes audio
specifically for the telephone codec chain:

  TTS (24kHz) → preprocess → LiveKit (Opus) → SIP (G.711 8kHz)

Optimizations:
  1. Low-pass filter at 3.4kHz (telephone band) — removes frequencies
     that will alias when downsampled to 8kHz
  2. Gentle high-shelf boost at 2-3kHz — compensates for G.711's
     tendency to muffle speech, improves clarity
  3. Dynamic range compression — keeps volume consistent (G.711 has
     limited dynamic range, quiet parts get lost)
  4. Normalization — maximize signal within G.711's range

This runs in real-time on TTS output chunks before they enter
the LiveKit room.
"""
import struct
import math


def preprocess_for_telephone(pcm_data: bytes, sample_rate: int = 24000) -> bytes:
    """
    Optimize PCM audio (16-bit signed, mono) for telephone playback.
    Returns processed PCM bytes.
    """
    if not pcm_data or len(pcm_data) < 4:
        return pcm_data

    # Unpack 16-bit signed samples
    n_samples = len(pcm_data) // 2
    samples = list(struct.unpack(f'<{n_samples}h', pcm_data))

    # 1. Low-pass filter at 3.4kHz (Butterworth-ish, single pole for speed)
    #    Prevents aliasing when G.711 downsamples to 8kHz
    cutoff = 3400.0
    rc = 1.0 / (2.0 * math.pi * cutoff)
    dt = 1.0 / sample_rate
    alpha = dt / (rc + dt)

    prev = float(samples[0])
    for i in range(1, n_samples):
        prev = prev + alpha * (float(samples[i]) - prev)
        samples[i] = int(prev)

    # 2. High-shelf boost at 2-3.2kHz (+3dB) — clarity boost for telephone
    #    Simple first-order shelf filter
    shelf_freq = 2500.0
    shelf_gain = 1.4  # ~3dB boost
    shelf_rc = 1.0 / (2.0 * math.pi * shelf_freq)
    shelf_alpha = dt / (shelf_rc + dt)

    hp_prev = 0.0
    for i in range(n_samples):
        hp = float(samples[i]) - hp_prev
        hp_prev = hp_prev + shelf_alpha * hp
        # Add boosted high-frequency content back
        samples[i] = int(float(samples[i]) + hp * (shelf_gain - 1.0))

    # 3. Compression — reduce dynamic range for G.711
    #    Soft-knee compressor: threshold -12dB, ratio 3:1
    threshold = 8000  # ~-12dB relative to max 32767
    ratio = 3.0

    for i in range(n_samples):
        s = float(samples[i])
        magnitude = abs(s)
        if magnitude > threshold:
            over = magnitude - threshold
            compressed = threshold + over / ratio
            samples[i] = int(math.copysign(compressed, s))

    # 4. Normalize — maximize level within 16-bit range
    #    Leave 1dB headroom to avoid clipping after G.711 conversion
    peak = max(abs(s) for s in samples) if samples else 1
    if peak > 0:
        target = 29000  # ~1dB below max, leaves headroom
        gain = target / peak
        if gain > 3.0:
            gain = 3.0  # Don't amplify noise too much
        samples = [int(s * gain) for s in samples]

    # Clamp to 16-bit range
    samples = [max(-32768, min(32767, s)) for s in samples]

    return struct.pack(f'<{n_samples}h', *samples)


def should_preprocess(call_type: str = "sip") -> bool:
    """Only preprocess for SIP/phone calls, not WebRTC/browser."""
    return call_type in ("sip", "phone", "pstn")
