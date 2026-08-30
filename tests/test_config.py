import os
from pathlib import Path

import pytest

from friday.config.settings import Settings


def test_default_settings_use_mock_provider():
    s = Settings(_env_file=None)  # type: ignore[call-arg]
    assert s.provider == "mock"
    assert s.is_provider_configured("mock") is True


def test_env_override(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("FRIDAY_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-123")
    s = Settings(_env_file=None)  # type: ignore[call-arg]
    assert s.provider == "openai"
    assert s.is_provider_configured("openai") is True
    assert s.openai_api_key is not None
    assert s.openai_api_key.get_secret_value() == "sk-test-123"


def test_is_provider_configured_negative(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    s = Settings(_env_file=None, OPENAI_API_KEY=None, ANTHROPIC_API_KEY=None)  # type: ignore[call-arg]
    assert s.is_provider_configured("openai") is False
    assert s.is_provider_configured("anthropic") is False
