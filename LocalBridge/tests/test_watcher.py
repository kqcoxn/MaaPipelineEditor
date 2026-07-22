from __future__ import annotations

from pathlib import Path

from watchfiles import Change
from workspace_helpers import create_project

from mpe_localbridge.watcher import normalize_changes, prepare_changes


def test_normalize_changes_merges_events_and_ignores_save_echo(tmp_path: Path) -> None:
    workspace = create_project(
        tmp_path,
        preferences_path=tmp_path / "preferences.json",
    )
    pipeline = tmp_path / "project" / "resource" / "pipeline"
    workspace.save_file("resource/pipeline/owned.json", None, {"Node": {}}, 2)
    external = pipeline / "external.json"
    external.write_text("{}\n", encoding="utf-8")

    events = normalize_changes(
        workspace,
        {
            (Change.added, str(external)),
            (Change.modified, str(external)),
            (Change.modified, str(pipeline / "owned.json")),
            (Change.modified, str(tmp_path / "ignored.txt")),
        },
    )

    assert events == [
        {
            "type": "created",
            "file_path": "resource/pipeline/external.json",
            "is_directory": False,
            "workspace_kind": "pipeline",
        }
    ]


def test_normalize_changes_rejects_symlink_escape(tmp_path: Path) -> None:
    workspace_root = tmp_path / "workspace"
    workspace = create_project(
        workspace_root,
        preferences_path=tmp_path / "preferences.json",
    )
    outside = tmp_path / "outside.json"
    outside.write_text("{}", encoding="utf-8")
    link = workspace_root / "link.json"
    try:
        link.symlink_to(outside)
    except OSError:
        return

    assert normalize_changes(workspace, {(Change.modified, str(link))}) == []


def test_prepare_changes_removes_internal_kind_from_every_event() -> None:
    events = [
        {
            "type": "modified",
            "file_path": "project/interface.json",
            "is_directory": False,
            "workspace_kind": "interface",
        },
        {
            "type": "modified",
            "file_path": "project/resource/pipeline/main.json",
            "is_directory": False,
            "workspace_kind": "pipeline",
        },
    ]

    public_events, needs_discovery, pipeline_events = prepare_changes(events)

    assert needs_discovery is True
    assert public_events == [
        {
            "type": "modified",
            "file_path": "project/interface.json",
            "is_directory": False,
        },
        {
            "type": "modified",
            "file_path": "project/resource/pipeline/main.json",
            "is_directory": False,
        },
    ]
    assert pipeline_events == [
        {
            "type": "modified",
            "file_path": "project/resource/pipeline/main.json",
            "is_directory": False,
        }
    ]


def test_normalize_changes_ignores_non_pipeline_json_and_marks_deleted_directory(
    tmp_path: Path,
) -> None:
    workspace = create_project(
        tmp_path,
        preferences_path=tmp_path / "preferences.json",
    )
    pipeline = tmp_path / "project" / "resource" / "pipeline"
    nested = pipeline / "nested"
    nested.mkdir()
    workspace.refresh_files()
    nested.rmdir()

    events = normalize_changes(
        workspace,
        {
            (Change.modified, str(pipeline / "notes.txt")),
            (Change.modified, str(pipeline / ".main.mpe.json")),
            (Change.deleted, str(nested)),
        },
    )

    assert events == [
        {
            "type": "deleted",
            "file_path": "resource/pipeline/nested",
            "is_directory": True,
            "workspace_kind": "pipeline",
        }
    ]


def test_normalize_changes_emits_ordinary_project_file_without_pipeline_refresh(
    tmp_path: Path,
) -> None:
    workspace = create_project(
        tmp_path,
        preferences_path=tmp_path / "preferences.json",
    )
    ordinary = tmp_path / "project" / "notes.txt"
    ordinary.write_text("notes", encoding="utf-8")
    workspace.refresh_tree()

    events = normalize_changes(workspace, {(Change.modified, str(ordinary))})
    public_events, needs_discovery, pipeline_events = prepare_changes(events)

    assert public_events == [
        {
            "type": "modified",
            "file_path": "notes.txt",
            "is_directory": False,
        }
    ]
    assert needs_discovery is False
    assert pipeline_events == []
