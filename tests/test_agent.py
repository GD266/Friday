import tempfile
from pathlib import Path

import pytest

from friday.agent import AgentRequest, FridayAgent
from friday.memory.store import MemoryStore
from friday.providers.registry import reset_registry


@pytest.mark.asyncio
async def test_agent_chat_with_mock():
    reset_registry()
    with tempfile.TemporaryDirectory() as td:
        mem = MemoryStore(path=Path(td) / "mem.json")
        agent = FridayAgent(provider_name="mock", memory=mem)
        resp = await agent.chat(AgentRequest(message="hello friday"))
        assert "hello friday" in resp.content.lower() or "echo" in resp.content.lower()
        assert resp.provider == "mock"
        assert mem.count() == 2  # user + assistant


@pytest.mark.asyncio
async def test_agent_stream():
    reset_registry()
    with tempfile.TemporaryDirectory() as td:
        mem = MemoryStore(path=Path(td) / "mem.json")
        agent = FridayAgent(provider_name="mock", memory=mem)
        deltas: list[str] = []
        async for d in agent.stream(AgentRequest(message="stream me")):
            deltas.append(d)
        full = "".join(deltas)
        assert "stream me" in full


@pytest.mark.asyncio
async def test_agent_health():
    reset_registry()
    with tempfile.TemporaryDirectory() as td:
        mem = MemoryStore(path=Path(td) / "mem.json")
        agent = FridayAgent(provider_name="mock", memory=mem)
        h = await agent.health_check()
        assert h["status"] == "ok"
        assert h["provider"] == "mock"
