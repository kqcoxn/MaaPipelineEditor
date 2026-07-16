from __future__ import annotations

from pathlib import Path

from mpe_localbridge.config import ConfigStore


def test_config_update_deep_merges_and_writes_atomically(tmp_path: Path) -> None:
    path = tmp_path / "config.json"
    store = ConfigStore(path)

    updated = store.update({"server": {"port": 0}, "file": {"root": str(tmp_path)}})

    assert updated.server.port == 0
    assert updated.server.host == "127.0.0.1"
    assert ConfigStore(path).value.file.root == str(tmp_path)
    assert not list(tmp_path.glob("*.tmp"))
