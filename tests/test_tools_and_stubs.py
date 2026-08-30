import pytest

from friday.computer_control.interface import StubComputerControl
from friday.tools.base import Tool, ToolResult
from friday.tools.registry import ToolRegistry
from friday.voice.interface import StubVoiceInterface


class DummyTool(Tool):
    name = "dummy"
    description = "dummy tool"

    async def run(self, **kwargs) -> ToolResult:
        return ToolResult(tool=self.name, success=True, output="ok")


def test_tool_registry():
    r = ToolRegistry()
    r.register(DummyTool())
    assert "dummy" in r.available()
    schemas = r.schemas()
    assert schemas[0]["function"]["name"] == "dummy"


@pytest.mark.asyncio
async def test_voice_stub():
    v = StubVoiceInterface()
    r = await v.transcribe("fake.wav")
    assert r.success is False
    assert "not implemented" in r.error.lower()
    assert await v.health_check() is False


@pytest.mark.asyncio
async def test_computer_control_sandbox():
    c = StubComputerControl(sandbox=True)
    r = await c.execute("click", x=10, y=10)
    assert r.success is False
    assert "sandbox" in r.error.lower()
