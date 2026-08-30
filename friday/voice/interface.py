"""Voice interface — intentionally a stub for the foundation milestone.

Real STT/TTS implementations will plug in here without changing callers.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass


@dataclass(frozen=True)
class VoiceResult:
    text: str
    success: bool
    error: str | None = None


class VoiceInterface(abc.ABC):
    """Abstract voice layer."""

    @abc.abstractmethod
    async def transcribe(self, audio_path: str) -> VoiceResult:
        """Speech-to-text."""
        raise NotImplementedError

    @abc.abstractmethod
    async def synthesize(self, text: str, output_path: str) -> VoiceResult:
        """Text-to-speech."""
        raise NotImplementedError

    @abc.abstractmethod
    async def health_check(self) -> bool:
        raise NotImplementedError


class StubVoiceInterface(VoiceInterface):
    """No-op stub used until voice is implemented."""

    async def transcribe(self, audio_path: str) -> VoiceResult:
        return VoiceResult(text="", success=False, error="Voice not implemented yet (stub).")

    async def synthesize(self, text: str, output_path: str) -> VoiceResult:
        return VoiceResult(text="", success=False, error="Voice not implemented yet (stub).")

    async def health_check(self) -> bool:
        return False
