"""Tool interface — all tools (computer control, web, etc.) implement this."""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ToolResult:
    tool: str
    success: bool
    output: Any = None
    error: str | None = None
    metadata: dict = field(default_factory=dict)


class Tool(abc.ABC):
    """Abstract tool."""

    name: str = "base_tool"
    description: str = "Base tool"
    # JSON Schema for parameters — used for provider tool-calling later
    parameters_schema: dict = {"type": "object", "properties": {}}

    @abc.abstractmethod
    async def run(self, **kwargs: Any) -> ToolResult:
        raise NotImplementedError

    def to_schema(self) -> dict:
        """Return OpenAI-compatible tool schema."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": getattr(self, "parameters_schema", {"type": "object", "properties": {}}),
            },
        }
