from __future__ import annotations

from pathlib import Path

from mpe_localbridge.paths import cache_dir, config_path, log_dir


def test_localbridge_user_paths_do_not_repeat_application_segments() -> None:
    paths = (config_path(), cache_dir(), log_dir())

    for path in paths:
        assert _part_count(path, "MaaPipelineEditor") == 1
        assert _part_count(path, "LocalBridge") == 1
    assert config_path().name == "config.json"


def _part_count(path: Path, expected: str) -> int:
    return sum(part.casefold() == expected.casefold() for part in path.parts)
