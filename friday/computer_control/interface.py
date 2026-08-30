"""Computer control interface — stub for foundation.

Future implementations (mouse/keyboard/window control) will implement
this interface. Sandbox flag prevents accidental execution.
"""

from __future__ import annotations

import abc
from dataclasses import dataclass


@dataclass(frozen=True)
class ControlResult:
    success: bool
    output: str | None = None
    error: str | None = None


class ComputerControlInterface(abc.ABC):
    @abc.abstractmethod
    async def execute(self, action: str, **kwargs: object) -> ControlResult:
        raise NotImplementedError

    @abc.abstractmethod
    async def health_check(self) -> bool:
        raise NotImplementedError


class StubComputerControl(ComputerControlInterface):
    """Safe stub — always blocked when sandbox is enabled (default)."""

    def __init__(self, *, sandbox: bool = True) -> None:
        self.sandbox = sandbox

    async def execute(self, action: str, **kwargs: object) -> ControlResult:
        if self.sandbox:
            return ControlResult(
                success=False,
                error=f"Computer control is in sandbox mode — blocked action '{action}'. "
                "Disable FRIDAY_COMPUTER_CONTROL_SANDBOX only if you understand the risks.",
            )
        return ControlResult(success=False, error="Computer control not implemented yet (stub).")

    async def health_check(self) -> bool:
        return False
