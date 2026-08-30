"""Central error hierarchy for Friday.

All domain errors inherit from FridayError so callers can
catch broadly or narrowly as needed.
"""

from __future__ import annotations


class FridayError(Exception):
    """Base class for all Friday errors."""

    def __init__(self, message: str, *, details: dict | None = None) -> None:
        super().__init__(message)
        self.details = details or {}


class ConfigurationError(FridayError):
    """Raised when configuration is missing or invalid."""


class ProviderError(FridayError):
    """Raised when an AI provider fails."""


class ProviderNotFoundError(ProviderError):
    """Raised when a requested provider is not registered."""


class ToolError(FridayError):
    """Raised when a tool invocation fails."""


class ToolNotFoundError(ToolError):
    """Raised when a requested tool is not registered."""


class MemoryError(FridayError):
    """Raised when memory read/write fails."""


class VoiceError(FridayError):
    """Raised when voice subsystem fails."""


class ComputerControlError(FridayError):
    """Raised when computer control fails or is blocked by sandbox."""
