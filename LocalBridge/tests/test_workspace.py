from __future__ import annotations

import json
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
        workspace.create_file("nested/test.json", "", {})


def test_create_file_only_allows_active_pipeline_directories(workspace: Workspace) -> None:
    allowed = "project/first/pipeline/nested"
    (workspace.root / allowed).mkdir()

    result = workspace.create_file("new.json", allowed, {"Start": {}})

    assert result["file_path"] == f"{allowed}/new.json"
    with pytest.raises(ForbiddenError):
        workspace.create_file("outside.json", "project", {})
    with pytest.raises(ForbiddenError):
        workspace.create_file("bundle.json", "project/first", {})


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
