from __future__ import annotations

import json
import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from workspace_helpers import create_project

from mpe_localbridge.config import FileConfig
from mpe_localbridge.errors import ForbiddenError, InvalidArgumentError, NotFoundError
from mpe_localbridge.workspace import Workspace


@pytest.fixture
def workspace(tmp_path: Path) -> Workspace:
    return create_project(
        tmp_path,
        resource_paths=["first", "second"],
        preferences_path=tmp_path / "preferences.json",
    )


def test_snapshot_reads_jsonc_without_rewriting_source(workspace: Workspace) -> None:
    source = """{
      // keep this comment
      \"$mpe\": { \"prefix\": \"demo\" },
      \"Start\": { \"anchor\": [\"A\", \"B\"] },
    }
    """
    path = workspace.root / "project" / "first" / "pipeline" / "pipeline.jsonc"
    path.write_text(source, encoding="utf-8")

    snapshot = workspace.refresh_files()
    revision = snapshot["revision"]
    relative_path = "project/first/pipeline/pipeline.jsonc"
    assert snapshot["files"][0]["index_status"] == "pending"
    workspace.index_file(revision, relative_path)
    snapshot = workspace.snapshot()

    assert snapshot["files"][0]["file_path"] == relative_path
    assert snapshot["files"][0]["prefix"] == "demo"
    assert snapshot["files"][0]["nodes"] == [
        {"label": "Start", "prefix": "demo", "anchors": ["A", "B"]}
    ]
    assert path.read_text(encoding="utf-8") == source


def test_resolve_rejects_absolute_and_parent_paths(workspace: Workspace, tmp_path: Path) -> None:
    with pytest.raises(InvalidArgumentError):
        workspace.resolve(str(tmp_path / "outside.json"))
    with pytest.raises(ForbiddenError):
        workspace.resolve("../outside.json")


def test_save_is_atomic_and_preserves_raw_json_text(workspace: Workspace) -> None:
    result = workspace.save_file("folder/test.jsonc", "{\n  // x\n  A: {}\n}", None, 4)

    assert result == {"file_path": "folder/test.jsonc", "status": "ok"}
    assert (workspace.root / "folder/test.jsonc").read_text(encoding="utf-8") == (
        "{\n  // x\n  A: {}\n}\n"
    )
    assert not list((workspace.root / "folder").glob("*.tmp"))


def test_create_file_rejects_nested_file_name(workspace: Workspace) -> None:
    with pytest.raises(InvalidArgumentError):
        workspace.create_file("nested/test.json", "")


def test_create_file_allows_project_directories_and_default_content(workspace: Workspace) -> None:
    allowed = "project/first/pipeline/nested"
    (workspace.root / allowed).mkdir()

    result = workspace.create_file("new.json", allowed)

    assert result["file_path"] == f"{allowed}/new.json"
    assert (workspace.root / allowed / "new.json").read_text(encoding="utf-8") == "{}\n"

    root_file = workspace.create_file("README.md", "")
    assert root_file["file_path"] == "README.md"
    assert (workspace.root / "README.md").read_text(encoding="utf-8") == ""

    outside_pipeline = workspace.create_file("bundle.json", "project/first")
    assert outside_pipeline["file_path"] == "project/first/bundle.json"


def test_create_file_rejects_path_components(workspace: Workspace) -> None:
    with pytest.raises(InvalidArgumentError):
        workspace.create_file("nested/test.json", "")
    with pytest.raises(InvalidArgumentError):
        workspace.create_file("nested\\test.json", "")


def test_rename_entry_changes_only_the_file_name(workspace: Workspace) -> None:
    source = workspace.root / "project" / "notes.txt"
    source.write_text("notes", encoding="utf-8")

    result = workspace.rename_entry("project/notes.txt", "renamed.txt")

    assert result == {
        "file_path": "project/notes.txt",
        "new_file_path": "project/renamed.txt",
        "is_directory": False,
        "status": "ok",
    }
    assert not source.exists()
    assert (workspace.root / "project" / "renamed.txt").read_text(encoding="utf-8") == "notes"


def test_rename_entry_renames_directories_with_their_contents(workspace: Workspace) -> None:
    directory = workspace.root / "project" / "nested"
    directory.mkdir()
    (directory / "notes.txt").write_text("notes", encoding="utf-8")

    result = workspace.rename_entry("project/nested", "renamed")

    assert result == {
        "file_path": "project/nested",
        "new_file_path": "project/renamed",
        "is_directory": True,
        "status": "ok",
    }
    assert not directory.exists()
    assert (workspace.root / "project/renamed/notes.txt").read_text(encoding="utf-8") == "notes"


def test_rename_entry_rejects_duplicates_and_nested_names(workspace: Workspace) -> None:
    (workspace.root / "project" / "notes.txt").write_text("notes", encoding="utf-8")
    (workspace.root / "project" / "other.txt").write_text("other", encoding="utf-8")

    with pytest.raises(InvalidArgumentError):
        workspace.rename_entry("project/notes.txt", "other.txt")
    with pytest.raises(InvalidArgumentError):
        workspace.rename_entry("project/notes.txt", "nested/notes.txt")


def test_delete_file_removes_only_files(workspace: Workspace) -> None:
    path = workspace.root / "project" / "notes.txt"
    path.write_text("notes", encoding="utf-8")

    assert workspace.delete_file("project/notes.txt") == {
        "file_path": "project/notes.txt",
        "status": "ok",
    }
    assert not path.exists()
    with pytest.raises(ForbiddenError):
        workspace.delete_file("project")


def test_separated_config_is_loaded(workspace: Workspace) -> None:
    (workspace.root / "flow.json").write_text(json.dumps({"A": {}}), encoding="utf-8")
    (workspace.root / ".flow.mpe.json").write_text(
        json.dumps({"version": 2}), encoding="utf-8"
    )

    opened = workspace.open_file("flow.json")

    assert opened["mpe_config"] == {"version": 2}
    assert opened["config_path"] == ".flow.mpe.json"


def test_resolve_image_name_uses_latest_resource_match(workspace: Workspace) -> None:
    first = workspace.root / "project" / "first" / "image" / "nested" / "sample.png"
    second = workspace.root / "project" / "second" / "image" / "sample.png"
    first.parent.mkdir(parents=True)
    second.parent.mkdir(parents=True)
    first.write_bytes(b"old")
    second.write_bytes(b"new")
    first.touch()
    second.touch()

    result = workspace.resolve_image_name("sample.png")

    assert result["relative_path"] == "sample.png"
    assert result["absolute_path"] == str(second.resolve())


def test_resolve_image_name_rejects_paths_and_missing_files(workspace: Workspace) -> None:
    with pytest.raises(InvalidArgumentError):
        workspace.resolve_image_name("../sample.png")
    with pytest.raises(NotFoundError):
        workspace.resolve_image_name("missing.png")


def test_refresh_files_does_not_read_pipeline_content(
    workspace: Workspace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pipeline = workspace.root / "project" / "first" / "pipeline" / "main.json"
    pipeline.write_text('{"Start": {}}', encoding="utf-8")

    def fail_parser(_: Path) -> object:
        raise AssertionError("元数据列表阶段不应读取 Pipeline 内容")

    monkeypatch.setattr("mpe_localbridge.workspace.load_json_or_jsonc", fail_parser)

    snapshot = workspace.refresh_files()

    assert snapshot["files"][0]["index_status"] == "pending"


def test_default_pipeline_is_listed_without_default_keys_in_node_index(
    workspace: Workspace,
) -> None:
    default_pipeline = workspace.root / "project" / "first" / "default_pipeline.json"
    default_pipeline.write_text(
        json.dumps({"Default": {}, "OCR": {}, "Click": {}}),
        encoding="utf-8",
    )

    snapshot = workspace.refresh_files()
    item = next(file for file in snapshot["files"] if file["is_default_pipeline"])

    assert item["index_status"] == "ready"
    assert item["nodes"] == []


def test_modified_pipeline_only_invalidates_its_own_index(
    workspace: Workspace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    first = workspace.root / "project" / "first" / "pipeline" / "first.json"
    second = workspace.root / "project" / "first" / "pipeline" / "second.json"
    first.write_text('{"First": {}}', encoding="utf-8")
    second.write_text('{"Second": {}}', encoding="utf-8")
    snapshot = workspace.refresh_files()
    revision = snapshot["revision"]
    for item in snapshot["files"]:
        workspace.index_file(revision, item["file_path"])

    first.write_text('{"FirstChanged": {}}', encoding="utf-8")

    def fail_walk(*_: object, **__: object) -> object:
        raise AssertionError("单文件修改不应重新遍历 Pipeline 目录")

    monkeypatch.setattr("mpe_localbridge.workspace.os.walk", fail_walk)
    updated = workspace.refresh_modified_files(
        ["project/first/pipeline/first.json"]
    )

    statuses = {item["file_name"]: item["index_status"] for item in updated["files"]}
    assert statuses == {"first.json": "pending", "second.json": "ready"}
    assert updated["revision"] > revision


def test_deleted_pipeline_is_removed_without_reindexing_unchanged_files(
    workspace: Workspace,
) -> None:
    first = workspace.root / "project" / "first" / "pipeline" / "first.json"
    second = workspace.root / "project" / "first" / "pipeline" / "second.json"
    first.write_text('{"First": {}}', encoding="utf-8")
    second.write_text('{"Second": {}}', encoding="utf-8")
    snapshot = workspace.refresh_files()
    for item in snapshot["files"]:
        workspace.index_file(snapshot["revision"], item["file_path"])

    first.unlink()
    updated = workspace.refresh_files(bump_revision=True)

    assert [item["file_name"] for item in updated["files"]] == ["second.json"]
    assert updated["files"][0]["index_status"] == "ready"


def test_multiple_interfaces_require_selection_and_restore_history(tmp_path: Path) -> None:
    preferences_path = tmp_path / "workspace-preferences.json"
    create_project(
        tmp_path,
        interface_dir="first",
        preferences_path=tmp_path / "first-setup-preferences.json",
    )
    create_project(
        tmp_path,
        interface_dir="second",
        preferences_path=tmp_path / "second-setup-preferences.json",
    )
    workspace = Workspace(FileConfig(root=str(tmp_path)), preferences_path)

    status = workspace.discover()
    assert status["state"] == "selection_required"

    selected = workspace.select_interface("second/interface.json")
    assert selected["current_interface"]["interface_path"] == "second/interface.json"

    restored = Workspace(FileConfig(root=str(tmp_path)), preferences_path)
    restored_status = restored.discover()
    assert restored_status["current_interface"]["interface_path"] == (
        "second/interface.json"
    )


@pytest.mark.parametrize(
    ("root_kind", "expected_reason"),
    [
        ("missing", "root_missing"),
        ("empty", "interface_not_found"),
        ("invalid", "interface_invalid"),
    ],
)
def test_invalid_workspace_reasons(
    tmp_path: Path,
    root_kind: str,
    expected_reason: str,
) -> None:
    root = tmp_path / root_kind
    if root_kind != "missing":
        root.mkdir()
    if root_kind == "invalid":
        (root / "interface.json").write_text("{}", encoding="utf-8")
    workspace = Workspace(
        FileConfig(root=str(root)),
        tmp_path / f"{root_kind}-preferences.json",
    )

    status = workspace.discover()

    assert status["state"] == "invalid"
    assert status["reason"] == expected_reason


def test_discovery_exposes_transition_without_changing_revision_twice(
    workspace: Workspace,
) -> None:
    previous_revision = workspace.revision

    discovering = workspace.begin_discovery()
    completed = workspace.discover(prepared=True)

    assert discovering["state"] == "discovering"
    assert discovering["revision"] == previous_revision + 1
    assert completed["revision"] == discovering["revision"]
    assert completed["state"] == "indexing"


def test_refresh_tree_lists_nested_empty_and_dot_directories(
    tmp_path: Path,
) -> None:
    workspace = create_project(
        tmp_path,
        preferences_path=tmp_path / "preferences.json",
    )
    empty = tmp_path / "project" / "empty"
    nested = tmp_path / "project" / "nested"
    dot_directory = tmp_path / "project" / ".visible"
    excluded = tmp_path / "project" / "excluded"
    empty.mkdir()
    nested.mkdir()
    dot_directory.mkdir()
    excluded.mkdir()
    (nested / "notes.txt").write_text("metadata only", encoding="utf-8")
    (dot_directory / ".config").write_text("shown", encoding="utf-8")
    (excluded / "hidden.txt").write_text("hidden", encoding="utf-8")
    workspace.reconfigure(FileConfig(root=str(tmp_path), exclude=["excluded"]))
    workspace.discover()
    workspace.refresh_files()

    first = workspace.refresh_tree()
    second = workspace.refresh_tree()
    entries = {item["path"]: item["kind"] for item in second["entries"]}

    assert first["root"] == str(workspace.root)
    assert second["revision"] == first["revision"] + 1
    assert entries["project/empty"] == "directory"
    assert entries["project/nested/notes.txt"] == "file"
    assert entries["project/.visible"] == "directory"
    assert entries["project/.visible/.config"] == "file"
    assert not any(path.startswith("project/excluded") for path in entries)


def test_refresh_tree_does_not_follow_internal_or_external_symlinks(
    tmp_path: Path,
) -> None:
    workspace = create_project(
        tmp_path / "workspace",
        preferences_path=tmp_path / "preferences.json",
    )
    internal_target = workspace.root / "project" / "internal.txt"
    external_target = tmp_path / "external"
    internal_target.write_text("internal", encoding="utf-8")
    external_target.mkdir()
    (external_target / "external.txt").write_text("external", encoding="utf-8")
    internal_link = workspace.root / "internal-link.txt"
    external_link = workspace.root / "external-link"
    try:
        internal_link.symlink_to(internal_target)
        external_link.symlink_to(external_target, target_is_directory=True)
    except OSError:
        return

    snapshot = workspace.refresh_tree()
    paths = {item["path"] for item in snapshot["entries"]}

    assert "internal-link.txt" not in paths
    assert "external-link" not in paths
    assert workspace.change_kind(internal_link) is None
    assert workspace.change_kind(external_link / "external.txt") is None


def test_refresh_tree_skips_unreadable_directory_contents_and_warns(
    workspace: Workspace,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    blocked = workspace.root / "blocked"
    blocked.mkdir()
    (blocked / "secret.txt").write_text("secret", encoding="utf-8")
    original_scandir = os.scandir

    def guarded_scandir(path: str | os.PathLike[str]) -> Iterator[os.DirEntry[str]]:
        if Path(path) == blocked:
            raise PermissionError("blocked for test")
        return original_scandir(path)

    monkeypatch.setattr("mpe_localbridge.workspace.os.scandir", guarded_scandir)
    caplog.set_level("WARNING", logger="mpe_localbridge.workspace")

    snapshot = workspace.refresh_tree()

    assert not any(
        item["path"].startswith("blocked") for item in snapshot["entries"]
    )
    assert "blocked for test" in caplog.text


def test_deleted_project_directory_retains_event_directory_metadata(
    workspace: Workspace,
) -> None:
    directory = workspace.root / "ordinary"
    directory.mkdir()
    workspace.refresh_tree()
    directory.rmdir()

    assert workspace.change_kind(directory) == "project"
    assert workspace.event_path(directory) == ("ordinary", True)
