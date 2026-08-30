"""FridayAgent — orchestration layer (foundation stub).

No AI reasoning yet — delegates to the configured provider via the
provider abstraction and persists conversation to memory. This keeps
the architecture ready for future tool-calling, voice, and computer
control without coupling to any specific LLM SDK.
"""

from __future__ import annotations

from typing import AsyncIterator

from friday.agent.types import AgentRequest, AgentResponse
from friday.config import get_settings
from friday.memory.store import MemoryStore
from friday.providers.base import ChatMessage
from friday.providers.registry import get_registry
from friday.utils.errors import ProviderError
from friday.utils.logging import get_logger

logger = get_logger(__name__)


class FridayAgent:
    """Main agent orchestrator."""

    def __init__(
        self,
        *,
        provider_name: str | None = None,
        memory: MemoryStore | None = None,
    ) -> None:
        settings = get_settings()
        self.provider_name = provider_name or settings.provider
        self.memory = memory or MemoryStore()
        self._registry = get_registry()

    def _resolve_provider(self, preferred: str | None = None):
        name = preferred or self.provider_name
        try:
            return self._registry.get(name)
        except Exception as exc:
            logger.warning("Provider '%s' not found, falling back to mock: %s", name, exc)
            return self._registry.get("mock")

    async def chat(self, request: AgentRequest) -> AgentResponse:
        """Single-turn chat via provider."""
        logger.info("Agent chat: session=%s provider=%s msg=%.80s", request.session_id, request.provider or self.provider_name, request.message)
        provider = self._resolve_provider(request.provider)

        # Persist user message
        try:
            self.memory.add(request.message, role="user", metadata={"session_id": request.session_id})
        except Exception as exc:
            logger.warning("Memory write failed (non-fatal): %s", exc)

        messages = [ChatMessage(role="user", content=request.message)]

        try:
            result = await provider.chat(messages)
        except Exception as exc:
            logger.exception("Provider chat failed")
            raise ProviderError(f"Provider '{provider.name}' failed: {exc}") from exc

        # Persist assistant reply
        try:
            self.memory.add(result.content, role="assistant", metadata={"session_id": request.session_id, "provider": result.provider})
        except Exception as exc:
            logger.warning("Memory write failed (non-fatal): %s", exc)

        return AgentResponse(
            content=result.content,
            provider=result.provider,
            model=result.model,
            session_id=request.session_id,
            usage=result.usage,
        )

    async def stream(self, request: AgentRequest) -> AsyncIterator[str]:
        """Streaming chat — yields deltas."""
        provider = self._resolve_provider(request.provider)
        messages = [ChatMessage(role="user", content=request.message)]
        full = ""
        try:
            async for chunk in provider.stream(messages):
                full += chunk.delta
                yield chunk.delta
                if chunk.done:
                    break
        except Exception as exc:
            logger.exception("Provider stream failed")
            raise ProviderError(f"Provider '{provider.name}' stream failed: {exc}") from exc

        # Persist after stream completes
        try:
            self.memory.add(request.message, role="user", metadata={"session_id": request.session_id})
            if full.strip():
                self.memory.add(full, role="assistant", metadata={"session_id": request.session_id, "provider": provider.name})
        except Exception as exc:
            logger.warning("Memory write after stream failed: %s", exc)

    async def health_check(self) -> dict:
        provider = self._resolve_provider()
        try:
            ok = await provider.health_check()
        except Exception:
            ok = False
        return {
            "status": "ok",
            "provider": provider.name,
            "provider_healthy": ok,
            "memory_count": self.memory.count(),
        }
