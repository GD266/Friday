"""Agent request/response types."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class AgentRequest:
    message: str
    session_id: str = "default"
    stream: bool = False
    provider: str | None = None
    metadata: dict = field(default_factory=dict)


@dataclass(frozen=True)
class AgentResponse:
    content: str
    provider: str
    model: str
    session_id: str
    usage: dict | None = None
    error: str | None = None
