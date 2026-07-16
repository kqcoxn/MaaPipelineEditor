from __future__ import annotations

import json
from pathlib import Path

import pytest

from mpe_localbridge.config import FileConfig
from mpe_localbridge.errors import ForbiddenError, InvalidArgumentError, NotFoundError
from mpe_localbridge.workspace import Workspace


@pytest.fixture
def workspace(tmp_path: Path) -> Workspace:
    return Workspace(FileConfig(root=str(tmp_path)))


def test_snapshot_reads_jsonc_without_rewriting_source(workspace: Workspace) -> None:
    source = """{
      // keep this comment
      \"$mpe\": { \"prefix\": \"demo\" },
      \"Start\": { \"anchor\": [\"A\", \"B\"] },
    }
    """
    path = workspace.root / "pipeline.jsonc"
    path.write_text(source, encoding="utf-8")

    snapshot = workspace.snapshot()

    assert snapshot["files"][0]["file_path"] == "pipeline.jsonc"
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


def test_separated_config_is_loaded(workspace: Workspace) -> None:
    (workspace.root / "flow.json").write_text(json.dumps({"A": {}}), encoding="utf-8")
    (workspace.root / ".flow.mpe.json").write_text(
        json.dumps({"version": 2}), encoding="utf-8"
    )

    opened = workspace.open_file("flow.json")

    assert opened["mpe_config"] == {"version": 2}
    assert opened["config_path"] == ".flow.mpe.json"


def test_resolve_image_name_uses_latest_resource_match(workspace: Workspace) -> None:
    first = workspace.root / "first" / "image" / "nested" / "sample.png"
    second = workspace.root / "second" / "image" / "sample.png"
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
