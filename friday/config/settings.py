"""Central configuration for Friday.

Uses pydantic-settings so every value can be overridden via environment
variables or a .env file. No secrets are ever hardcoded.

Env var mapping:
    - All fields support FRIDAY_* prefix where noted, or plain provider vars
      like OPENAI_API_KEY.
    - .env file at project root is loaded automatically if present.

Access via:
    from friday.config import get_settings
    settings = get_settings()
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from env / .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # General
    env: Literal["development", "production", "test"] = Field(
        default="development", alias="FRIDAY_ENV"
    )
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = Field(
        default="INFO", alias="FRIDAY_LOG_LEVEL"
    )
    host: str = Field(default="127.0.0.1", alias="FRIDAY_HOST")
    port: int = Field(default=8000, alias="FRIDAY_PORT")

    # Provider selection
    provider: str = Field(default="mock", alias="FRIDAY_PROVIDER")

    # OpenAI
    openai_api_key: SecretStr | None = Field(default=None, alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4o-mini", alias="OPENAI_MODEL")
    openai_base_url: str = Field(default="https://api.openai.com/v1", alias="OPENAI_BASE_URL")

    # Anthropic
    anthropic_api_key: SecretStr | None = Field(default=None, alias="ANTHROPIC_API_KEY")
    anthropic_model: str = Field(default="claude-3-5-sonnet-latest", alias="ANTHROPIC_MODEL")

    # OpenRouter
    openrouter_api_key: SecretStr | None = Field(default=None, alias="OPENROUTER_API_KEY")
    openrouter_model: str = Field(default="openai/gpt-4o-mini", alias="OPENROUTER_MODEL")

    # Ollama
    ollama_base_url: str = Field(default="http://localhost:11434", alias="OLLAMA_BASE_URL")
    ollama_model: str = Field(default="llama3.1", alias="OLLAMA_MODEL")

    # Gemini
    gemini_api_key: SecretStr | None = Field(default=None, alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-1.5-flash", alias="GEMINI_MODEL")

    # Memory
    memory_path: Path = Field(default=Path("./data/memory.json"), alias="FRIDAY_MEMORY_PATH")
    memory_backend: Literal["json", "sqlite", "vector"] = Field(
        default="json", alias="FRIDAY_MEMORY_BACKEND"
    )

    # Voice (stub)
    voice_enabled: bool = Field(default=False, alias="FRIDAY_VOICE_ENABLED")
    stt_provider: str = Field(default="whisper", alias="FRIDAY_STT_PROVIDER")
    tts_provider: str = Field(default="elevenlabs", alias="FRIDAY_TTS_PROVIDER")

    # Computer control (stub)
    computer_control_enabled: bool = Field(default=False, alias="FRIDAY_COMPUTER_CONTROL_ENABLED")
    computer_control_sandbox: bool = Field(default=True, alias="FRIDAY_COMPUTER_CONTROL_SANDBOX")

    @field_validator("provider")
    @classmethod
    def _normalize_provider(cls, v: str) -> str:
        return v.strip().lower()

    def is_provider_configured(self, name: str) -> bool:
        """Return True if the named provider has required credentials (or none needed)."""
        name = name.lower()
        if name == "mock":
            return True
        if name == "openai":
            return bool(self.openai_api_key and self.openai_api_key.get_secret_value())
        if name == "anthropic":
            return bool(self.anthropic_api_key and self.anthropic_api_key.get_secret_value())
        if name == "openrouter":
            return bool(self.openrouter_api_key and self.openrouter_api_key.get_secret_value())
        if name == "ollama":
            return bool(self.ollama_base_url)
        if name == "gemini":
            return bool(self.gemini_api_key and self.gemini_api_key.get_secret_value())
        return False

    @property
    def is_development(self) -> bool:
        return self.env == "development"

    @property
    def is_production(self) -> bool:
        return self.env == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings instance. Call get_settings.cache_clear() to reload."""
    # Ensure dotenv is loaded for plain `os.getenv` users as well
    try:
        from dotenv import load_dotenv  # type: ignore

        load_dotenv(override=False)
    except ImportError:
        pass
    return Settings()  # type: ignore[call-arg]
