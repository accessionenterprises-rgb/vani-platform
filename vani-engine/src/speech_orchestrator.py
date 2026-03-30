"""
Speech Orchestrator — transforms raw LLM output into natural-sounding speech.

Sits between LLM and TTS as a tts_text_transforms callable.
Handles: buffering, sentence chunking, prosody tagging, pacing control.

Usage:
    session = AgentSession(
        tts_text_transforms=["filter_markdown", "filter_emoji", speech_orchestrator()],
        ...
    )
"""
import re
from collections.abc import AsyncIterable


def speech_orchestrator(
    min_chunk_words: int = 5,
    max_chunk_words: int = 12,
    buffer_chars: int = 60,
):
    """Create a text transform that reshapes LLM output for natural speech.

    - Buffers tokens until a phrase boundary
    - Splits long sentences into speakable chunks (5-12 words)
    - Adds prosody markers (ellipsis for pauses, commas for breath)
    - Ensures clean punctuation

    Args:
        min_chunk_words: Minimum words before yielding a chunk
        max_chunk_words: Maximum words per chunk (forces split)
        buffer_chars: Minimum characters to buffer before processing
    """

    async def _transform(text: AsyncIterable[str]) -> AsyncIterable[str]:
        buffer = ""

        async for token in text:
            buffer += token

            # Yield immediately on sentence boundaries
            if _has_sentence_end(buffer):
                chunks = _split_into_chunks(buffer, min_chunk_words, max_chunk_words)
                for chunk in chunks:
                    cleaned = _apply_prosody(chunk)
                    if cleaned.strip():
                        yield cleaned + " "
                buffer = ""
                continue

            # If buffer is long enough, check for natural break points
            words = buffer.split()
            if len(words) >= min_chunk_words:
                last_word = words[-1].lower().rstrip(".,!?")
                # Break at conjunctions or commas
                if last_word in ("and", "but", "so", "because", "then", "or") or buffer.rstrip().endswith(","):
                    cleaned = _apply_prosody(buffer)
                    if cleaned.strip():
                        yield cleaned + " "
                    buffer = ""
                    continue

            # Force flush if too long
            if len(words) >= max_chunk_words:
                cleaned = _apply_prosody(buffer)
                if cleaned.strip():
                    yield cleaned + " "
                buffer = ""

        # Flush remaining buffer
        if buffer.strip():
            cleaned = _apply_prosody(buffer.strip())
            if cleaned.strip():
                yield cleaned

    return _transform


def _has_sentence_end(text: str) -> bool:
    """Check if text ends with a sentence boundary."""
    stripped = text.rstrip()
    return bool(stripped) and stripped[-1] in ".!?;:"


def _split_into_chunks(text: str, min_words: int, max_words: int) -> list[str]:
    """Split text into speakable chunks at natural boundaries."""
    # First split on sentence boundaries
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())

    chunks = []
    for sentence in sentences:
        words = sentence.split()

        if len(words) <= max_words:
            chunks.append(sentence)
            continue

        # Split long sentences at natural boundaries
        current = []
        for word in words:
            current.append(word)

            # Check for natural break points
            if len(current) >= min_words:
                joined = " ".join(current)
                # Break at commas, conjunctions, or max length
                if (
                    word.endswith(",")
                    or word.endswith("—")
                    or word.endswith(":")
                    or word.lower() in ("and", "but", "so", "because", "then", "or", "which", "that")
                    or len(current) >= max_words
                ):
                    chunks.append(joined)
                    current = []

        if current:
            chunks.append(" ".join(current))

    return chunks


def _apply_prosody(text: str) -> str:
    """Add subtle prosody markers for more natural TTS output."""
    text = text.strip()

    if not text:
        return text

    # Ensure proper capitalization
    text = text[0].upper() + text[1:]

    # Ensure sentence ends with punctuation
    if text[-1] not in ".!?,;:—":
        text += "."

    # Add breath pause after transitional phrases
    transitions = [
        "so basically", "well", "actually", "you know",
        "I mean", "honestly", "look", "okay so",
    ]
    for phrase in transitions:
        pattern = re.compile(r'\b' + re.escape(phrase) + r'\b', re.IGNORECASE)
        text = pattern.sub(phrase + ",", text)

    # Clean up double punctuation
    text = re.sub(r'[,]{2,}', ',', text)
    text = re.sub(r'[.]{2,}', '.', text)
    text = re.sub(r'\s+', ' ', text)

    return text
