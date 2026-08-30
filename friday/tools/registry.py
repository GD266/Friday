"""Tool registry."""

from __future__ import annotations

from friday.tools.base import Tool
from friday.utils.errors import ToolNotFoundError
from friday.utils.logging import get_logger

logger = get_logger(__name__)


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        key = tool.name.lower()
        if key in self._tools:
            logger.warning("Overriding tool '%s'", key)
        self._tools[key] = tool
        logger.info("Registered tool: %s", key)

    def get(self, name: str) -> Tool:
        key = name.lower()
        if key not in self._tools:
            raise ToolNotFoundError(f"Tool '{name}' not found. Available: {self.available()}")
        return self._tools[key]

    def available(self) -> list[str]:
        return sorted(self._tools.keys())

    def schemas(self) -> list[dict]:
        return [t.to_schema() for t in self._tools.values()]


_registry: ToolRegistry | None = None


def get_tool_registry() -> ToolRegistry:
    global _registry
    if _registry is None:
        _registry = ToolRegistry()
    return _registry


def reset_tool_registry() -> None:
    global _registry
    _registry = None
