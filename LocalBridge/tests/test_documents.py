from __future__ import annotations

import json
from pathlib import Path

import pytest
from workspace_helpers import create_project

from mpe_localbridge.config import FileConfig
from mpe_localbridge.errors import (
    DocumentConflictError,
    ForbiddenError,
    InvalidArgumentError,
    NotFoundError,
)
from mpe_localbridge.workspace import Workspace


def _prepare_documents(tmp_path: Path) -> Workspace:
    workspace = create_project(
        tmp_path,
        preferences_path=tmp_path / "preferences.json",
    )
    project = workspace.root / "project"
    interface_path = project / "interface.json"
    interface = json.loads(interface_path.read_text(encoding="utf-8"))
    interface["import"] = ["interface.import.jsonc"]
    interface_path.write_text(json.dumps(interface), encoding="utf-8")
    (project / "interface.import.jsonc").write_text(
        "// imported\n{\"name\": \"shared\"}\n",
        encoding="utf-8",
    )
    (project / "resource" / "pipeline" / "main.jsonc").write_text(
        "// pipeline\n{\"Start\": {}}\n",
        encoding="utf-8",
    )
    (project / "resource" / "default_pipeline.json").write_text(
        '{"Default": {}}\n',
        encoding="utf-8",
    )
    (project / "settings.jsonc").write_text("// keep\n{\"a\": 1}\n", encoding="utf-8")
    (project / ".main.mpe.jsonc").write_text("{}\n", encoding="utf-8")
    (project / "agent.py").write_text("print('hello')\n", encoding="utf-8")
    (project / ".env").write_text("KEY=value\n", encoding="utf-8")
    (workspace.root / "README.md").write_text("# Project\n", encoding="utf-8")
    (project / "preview.png").write_bytes(b"\x89PNG\r\n\x1a\n")
    (project / "archive.bin").write_bytes(b"\x00\x01\x02")
    (project / ".visible").write_text("visible\n", encoding="utf-8")

    workspace.discover()
    workspace.refresh_files()
    workspace.refresh_tree()
    workspace.refresh_documents()
    return workspace


def _documents_by_path(workspace: Workspace) -> dict[str, dict[str, object]]:
    return {
        document["path"]: document
        for document in workspace.documents_snapshot()["documents"]
    }


def test_document_index_classifies_project_files(tmp_path: Path) -> None:
    workspace = _prepare_documents(tmp_path)
    documents = _documents_by_path(workspace)

    assert documents["project/interface.json"]["kind"] == "interface"
    assert documents["project/interface.import.jsonc"]["kind"] == "interface"
    pipeline = documents["project/resource/pipeline/main.jsonc"]
    assert pipeline["kind"] == "pipeline"
    assert pipeline["editable"] is False
    default_pipeline = documents["project/resource/default_pipeline.json"]
    assert default_pipeline["kind"] == "json"
    assert default_pipeline["role"] == "default_pipeline"
    assert documents["project/settings.jsonc"]["kind"] == "json"
    assert documents["project/.main.mpe.jsonc"]["role"] == "mpe_config"
    assert documents["project/agent.py"]["language"] == "python"
    assert documents["project/.env"]["kind"] == "text"
    assert documents["README.md"]["kind"] == "markdown"
    assert documents["project/preview.png"]["kind"] == "image"
    assert documents["project/archive.bin"]["kind"] == "binary"
    assert "project/.visible" in documents


def test_document_index_uses_independent_revision_and_does_not_read_content(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    workspace = _prepare_documents(tmp_path)
    previous = workspace.documents_snapshot()["revision"]

    def fail_read(_: Path) -> bytes:
        raise AssertionError("文档能力扫描不应读取文件内容")

    monkeypatch.setattr(Path, "read_bytes", fail_read)
    workspace.refresh_tree()
    current = workspace.refresh_documents()

    assert current["revision"] == previous + 1


def test_open_and_save_document_preserve_jsonc_source(tmp_path: Path) -> None:
    workspace = _prepare_documents(tmp_path)
    path = "project/settings.jsonc"
    opened = workspace.open_document(path)
    changed = "// keep comment\n{\n  \"second\": 2,\n  \"first\": 1\n}\r\n"

    saved = workspace.save_document(path, changed, opened["revision"])

    assert saved["revision"] == saved["sha256"]
    assert (workspace.root / path).read_bytes() == changed.encode("utf-8")
    assert not list((workspace.root / "project").glob("*.tmp"))


def test_save_document_rejects_stale_revision_and_non_text(tmp_path: Path) -> None:
    workspace = _prepare_documents(tmp_path)
    path = "project/settings.jsonc"
    opened = workspace.open_document(path)
    (workspace.root / path).write_text('{"external": true}\n', encoding="utf-8")

    with pytest.raises(DocumentConflictError) as conflict:
        workspace.save_document(path, '{"local": true}\n', opened["revision"])
    assert conflict.value.code == "document_conflict"
    assert conflict.value.data is not None
    assert conflict.value.data["path"] == path

    with pytest.raises(ForbiddenError):
        workspace.save_document(
            "project/archive.bin",
            "not binary",
            workspace.open_document("project/archive.bin")["revision"],
        )
    with pytest.raises(ForbiddenError):
        workspace.save_document(
            "project/resource/pipeline/main.jsonc",
            "{}",
            workspace.open_document("project/resource/pipeline/main.jsonc")["revision"],
        )


def test_open_document_reports_image_binary_and_large_text_metadata(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    workspace = _prepare_documents(tmp_path)
    monkeypatch.setattr("mpe_localbridge.workspace.MAX_WS_MESSAGE_BYTES", 8)
    large_path = workspace.root / "project" / "large.txt"
    large_path.write_text("larger than eight bytes", encoding="utf-8")
    workspace.refresh_tree()
    workspace.refresh_documents()

    image = workspace.open_document("project/preview.png")
    binary = workspace.open_document("project/archive.bin")
    large = workspace.open_document("project/large.txt")

    assert image["kind"] == "image" and image["_path"] == workspace.root / "project/preview.png"
    assert binary["kind"] == "binary" and "content" not in binary
    assert large["read_only_reason"] == "too_large"
    assert large["editable"] is False
    assert "content" not in large


def test_document_access_rejects_unindexed_excluded_and_unsafe_paths(tmp_path: Path) -> None:
    workspace = _prepare_documents(tmp_path)
    excluded = workspace.root / "excluded"
    excluded.mkdir()
    (excluded / "secret.txt").write_text("secret", encoding="utf-8")
    workspace.reconfigure(
        FileConfig(root=str(workspace.root), exclude=[*workspace.config.exclude, "excluded"])
    )
    workspace.discover()
    workspace.refresh_files()
    workspace.refresh_tree()
    workspace.refresh_documents()

    with pytest.raises((InvalidArgumentError, ForbiddenError)):
        workspace.open_document("../outside.txt")
    with pytest.raises((ForbiddenError, NotFoundError)):
        workspace.open_document("excluded/secret.txt")


def test_document_index_and_open_reject_symlinks(tmp_path: Path) -> None:
    workspace = _prepare_documents(tmp_path / "workspace")
    target = workspace.root / "project" / "agent.py"
    link = workspace.root / "linked.py"
    try:
        link.symlink_to(target)
    except OSError:
        return

    workspace.refresh_tree()
    workspace.refresh_documents()

    assert "linked.py" not in _documents_by_path(workspace)
    with pytest.raises((ForbiddenError, NotFoundError)):
        workspace.open_document("linked.py")
