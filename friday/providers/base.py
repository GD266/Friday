"""Provider abstraction — swap AI backends without touching agent code."""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import AsyncIterator, Literal

Role = Literal["system", "user", "assistant", "tool"]


@dataclass(frozen=True)
class ChatMessage:
    role: Role
    content: str
    name: str | None = None
    tool_call_id: str | None = None


@dataclass(frozen=True)
class ChatResponse:
    content: str
    model: str
    provider: str
    finish_reason: str = "stop"
    usage: dict | None = None
    raw: dict | None = field(default=None, repr=False)


@dataclass(frozen=True)
class StreamChunk:
    delta: str
    provider: str
    model: str
    done: bool = False


@dataclass(frozen=True)
class ProviderCapabilities:
    supports_streaming: bool = True
    supports_tools: bool = False
    supports_vision: bool = False


class Provider(abc.ABC):
    """Abstract AI provider.

    Concrete providers (OpenAI, Anthropic, Ollama, etc.) must inherit
    from this class and implement `chat`, `stream`, and `health_check`.

    The agent interacts ONLY with this interface.
    """

    name: str = "base"
    capabilities: ProviderCapabilities = ProviderCapabilities()

    @abc.abstractmethod
    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        **kwargs: object,
    ) -> ChatResponse:
        """Single-turn chat completion."""
        raise NotImplementedError

    @abc.abstractmethod
    async def stream(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        **kwargs: object,
    ) -> AsyncIterator[StreamChunk]:
        """Streaming chat completion. Yields deltas."""
        raise NotImplementedError
        yield  # type: ignore[misc]  # make this an async generator for type checkers

    @abc.abstractmethod
    async def health_check(self) -> bool:
        """Return True if provider is reachable/configured."""
        raise NotImplementedError

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} name={self.name}>"
