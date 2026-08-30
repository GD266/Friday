"""Mock provider — deterministic, no network, no API keys.

Used for development, tests, and as a safe fallback when no provider
is configured. Mirrors the real Provider interface.
"""

from __future__ import annotations

import asyncio
from typing import AsyncIterator

from friday.providers.base import ChatMessage, ChatResponse, Provider, ProviderCapabilities, StreamChunk


class MockProvider(Provider):
    name = "mock"
    capabilities = ProviderCapabilities(
        supports_streaming=True, supports_tools=False, supports_vision=False
    )

    def __init__(self, *, model: str = "mock-model", latency_ms: int = 20) -> None:
        self._model = model
        self._latency_ms = latency_ms

    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        **kwargs: object,
    ) -> ChatResponse:
        await asyncio.sleep(self._latency_ms / 1000)
        last_user = next((m.content for m in reversed(messages) if m.role == "user"), "")
        # Deterministic echo — stable for snapshot tests
        content = f"[mock:{model or self._model}] Echo: {last_user}" if last_user else "[mock] Hello from Friday (mock provider)."
        return ChatResponse(
            content=content,
            model=model or self._model,
            provider=self.name,
            finish_reason="stop",
            usage={"prompt_tokens": 0, "completion_tokens": 0},
            raw={"mock": True},
        )

    async def stream(
        self,
        messages: list[ChatMessage],
        *,
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        **kwargs: object,
    ) -> AsyncIterator[StreamChunk]:
        response = await self.chat(messages, model=model, temperature=temperature, max_tokens=max_tokens, **kwargs)
        # Yield word-by-word to simulate streaming
        words = response.content.split(" ")
        for i, word in enumerate(words):
            piece = word + (" " if i < len(words) - 1 else "")
            yield StreamChunk(delta=piece, provider=self.name, model=response.model, done=False)
            await asyncio.sleep(0.01)
        yield StreamChunk(delta="", provider=self.name, model=response.model, done=True)

    async def health_check(self) -> bool:
        return True
