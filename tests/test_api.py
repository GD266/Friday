import os
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from friday.__main__ import build_app


@pytest.fixture
def client():
    # Use temp memory file so tests don't pollute ./data
    with tempfile.TemporaryDirectory() as td:
        mem_path = Path(td) / "mem.json"
        with patch.dict(os.environ, {"FRIDAY_MEMORY_PATH": str(mem_path)}):
            from friday.config.settings import get_settings

            get_settings.cache_clear()
            # Ensure MemoryStore will use the temp path
            app = build_app()
            with TestClient(app) as c:
                yield c
            get_settings.cache_clear()


def test_root(client: TestClient):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_health(client: TestClient):
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "provider" in data


def test_chat(client: TestClient):
    r = client.post("/chat", json={"message": "hello"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "content" in data
    assert "hello" in data["content"].lower() or "echo" in data["content"].lower()


def test_chat_empty_rejected(client: TestClient):
    r = client.post("/chat", json={"message": "   "})
    assert r.status_code == 400
