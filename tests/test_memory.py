import tempfile
from pathlib import Path

from friday.memory.store import MemoryStore


def test_memory_add_and_list():
    with tempfile.TemporaryDirectory() as td:
        path = Path(td) / "m.json"
        store = MemoryStore(path=path)
        assert store.count() == 0
        store.add("hello", role="user")
        store.add("world", role="assistant")
        assert store.count() == 2
        entries = store.list(limit=10)
        assert entries[0].content == "hello"
        assert entries[1].content == "world"


def test_memory_persistence():
    with tempfile.TemporaryDirectory() as td:
        path = Path(td) / "m.json"
        s1 = MemoryStore(path=path)
        s1.add("persist me")
        s2 = MemoryStore(path=path)
        assert s2.count() == 1
        assert s2.list()[0].content == "persist me"


def test_memory_search():
    with tempfile.TemporaryDirectory() as td:
        path = Path(td) / "m.json"
        s = MemoryStore(path=path)
        s.add("I love pizza")
        s.add("I love pasta")
        s.add("Rust is great")
        results = s.search("pizza")
        assert len(results) == 1
        assert "pizza" in results[0].content
