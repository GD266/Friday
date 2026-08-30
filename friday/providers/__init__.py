"""AI provider abstraction."""

from friday.providers.base import (
    ChatMessage,
    ChatResponse,
    Provider,
    ProviderCapabilities,
    StreamChunk,
)
from friday.providers.mock import MockProvider
from friday.providers.registry import ProviderRegistry, get_registry

__all__ = [
    "ChatMessage",
    "ChatResponse",
    "Provider",
    "ProviderCapabilities",
    "StreamChunk",
    "MockProvider",
    "ProviderRegistry",
    "get_registry",
]
