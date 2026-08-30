import pytest

from friday.providers.base import ChatMessage
from friday.providers.mock import MockProvider
from friday.providers.registry import ProviderRegistry


@pytest.mark.asyncio
async def test_mock_provider_chat():
    p = MockProvider()
    resp = await p.chat([ChatMessage(role="user", content="hello")])
    assert "hello" in resp.content
    assert resp.provider == "mock"
    assert resp.model == "mock-model"


@pytest.mark.asyncio
async def test_mock_provider_stream():
    p = MockProvider()
    chunks = []
    async for c in p.stream([ChatMessage(role="user", content="stream test")]):
        chunks.append(c)
    assert len(chunks) >= 2
    assert chunks[-1].done is True
    joined = "".join(c.delta for c in chunks)
    assert "stream test" in joined


@pytest.mark.asyncio
async def test_mock_health():
    p = MockProvider()
    assert await p.health_check() is True


def test_registry_default_is_mock():
    r = ProviderRegistry()
    assert "mock" in r.available()
    p = r.get("mock")
    assert p.name == "mock"
    assert r.default("nonexistent").name == "mock"


def test_registry_missing_raises():
    r = ProviderRegistry()
    with pytest.raises(Exception) as exc:
        r.get("does_not_exist")
    assert "not found" in str(exc.value).lower()
