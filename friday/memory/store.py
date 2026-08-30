"""Memory store — simple JSON-backed store, swappable for vector DB later.

Interface is intentionally small so the backend can be replaced without
changing callers.
"""

from __future__ import annotations

import json
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from friday.utils.errors import MemoryError
from friday.utils.logging import get_logger

logger = get_logger(__name__)


@dataclass
class MemoryEntry:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    content: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    role: str = "user"  # user | assistant | system


class MemoryStore:
    """Abstract-ish store with JSON persistence.

    Swap `backend` later to sqlite/vector by subclassing and overriding
    `save`/`load`/`search`.
    """

    def __init__(self, path: Path | str | None = None) -> None:
        from friday.config import get_settings

        settings = get_settings()
        self.path = Path(path) if path else settings.memory_path
        self._entries: list[MemoryEntry] = []
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            logger.info("Memory file not found, starting empty: %s", self.path)
            return
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            self._entries = [MemoryEntry(**item) for item in data]
            logger.info("Loaded %d memory entries from %s", len(self._entries), self.path)
        except Exception as exc:
            raise MemoryError(f"Failed to load memory from {self.path}: {exc}") from exc

    def _save(self) -> None:
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            payload = [asdict(e) for e in self._entries]
            self.path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        except Exception as exc:
            raise MemoryError(f"Failed to save memory to {self.path}: {exc}") from exc

    def add(self, content: str, *, role: str = "user", metadata: dict | None = None) -> MemoryEntry:
        entry = MemoryEntry(content=content, role=role, metadata=metadata or {})
        self._entries.append(entry)
        self._save()
        logger.debug("Memory added: %s (%s)", entry.id, role)
        return entry

    def list(self, limit: int = 50) -> list[MemoryEntry]:
        return list(self._entries[-limit:])

    def search(self, query: str, limit: int = 5) -> list[MemoryEntry]:
        """Naive substring search — replace with vector search later."""
        q = query.lower()
        scored = [e for e in self._entries if q in e.content.lower()]
        return scored[-limit:]

    def clear(self) -> None:
        self._entries.clear()
        self._save()
        logger.warning("Memory cleared: %s", self.path)

    def count(self) -> int:
        return len(self._entries)
