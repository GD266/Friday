"""Provider registry — single place to register / resolve providers."""

from __future__ import annotations

from friday.providers.base import Provider
from friday.providers.mock import MockProvider
from friday.utils.errors import ProviderNotFoundError
from friday.utils.logging import get_logger

logger = get_logger(__name__)


class ProviderRegistry:
    """Registry for AI providers."""

    def __init__(self) -> None:
        self._providers: dict[str, Provider] = {}
        # Always register mock so the app boots without API keys
        self.register(MockProvider())

    def register(self, provider: Provider) -> None:
        key = provider.name.lower()
        if key in self._providers:
            logger.warning("Overriding provider '%s'", key)
        self._providers[key] = provider
        logger.info("Registered provider: %s", key)

    def get(self, name: str) -> Provider:
        key = name.lower()
        if key not in self._providers:
            raise ProviderNotFoundError(
                f"Provider '{name}' not found. Available: {self.available()}",
                details={"requested": name, "available": self.available()},
            )
        return self._providers[key]

    def available(self) -> list[str]:
        return sorted(self._providers.keys())

    def default(self, preferred: str | None = None) -> Provider:
        """Return preferred provider if available, else mock."""
        if preferred and preferred.lower() in self._providers:
            return self.get(preferred)
        return self.get("mock")


# Module-level singleton
_registry: ProviderRegistry | None = None


def get_registry() -> ProviderRegistry:
    global _registry
    if _registry is None:
        _registry = ProviderRegistry()
    return _registry


def reset_registry() -> None:
    """Reset singleton (useful in tests)."""
    global _registry
    _registry = None
