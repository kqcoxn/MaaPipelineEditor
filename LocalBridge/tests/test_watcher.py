from __future__ import annotations

from pathlib import Path

from watchfiles import Change

from mpe_localbridge.config import FileConfig
from mpe_localbridge.watcher import normalize_changes
from mpe_localbridge.workspace import Workspace


def test_normalize_changes_merges_events_and_ignores_save_echo(tmp_path: Path) -> None:
    workspace = Workspace(FileConfig(root=str(tmp_path)))
    workspace.save_file("owned.json", None, {"Node": {}}, 2)
    external = tmp_path / "external.json"
    external.write_text("{}\n", encoding="utf-8")

    events = normalize_changes(
        workspace,
        {
            (Change.added, str(external)),
            (Change.modified, str(external)),
            (Change.modified, str(tmp_path / "owned.json")),
            (Change.modified, str(tmp_path / "ignored.txt")),
        },
    )

    assert events == [
        {"type": "created", "file_path": "external.json", "is_directory": False}
    ]


def test_normalize_changes_rejects_symlink_escape(tmp_path: Path) -> None:
    workspace_root = tmp_path / "workspace"
    workspace_root.mkdir()
    workspace = Workspace(FileConfig(root=str(workspace_root)))
    outside = tmp_path / "outside.json"
    outside.write_text("{}", encoding="utf-8")
    link = workspace_root / "link.json"
    try:
        link.symlink_to(outside)
    except OSError:
        return

    assert normalize_changes(workspace, {(Change.modified, str(link))}) == []
