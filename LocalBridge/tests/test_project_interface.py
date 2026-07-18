from __future__ import annotations

import json
from pathlib import Path

import pytest

from mpe_localbridge.config import FileConfig
from mpe_localbridge.project_interface import (
    WorkspacePreferences,
    discover_interfaces,
    load_json_or_jsonc,
)


def _write_interface(path: Path, document: dict[str, object], *, jsonc: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(document, ensure_ascii=False, indent=2)
    if jsonc:
        content = "// Project Interface\n" + content
    path.write_text(content, encoding="utf-8")


def test_default_file_config_skips_maafw_dependency_directory(tmp_path: Path) -> None:
    _write_interface(
        tmp_path / "project" / "interface.json",
        {
            "interface_version": 2,
            "resource": [{"path": ["resource"]}],
        },
    )
    _write_interface(
        tmp_path / "deps" / "sample" / "interface.json",
        {
            "interface_version": 2,
            "resource": [{"path": ["resource"]}],
        },
    )

    discovery = discover_interfaces(tmp_path.resolve(), set(FileConfig().exclude))

    assert [item.relative_path for item in discovery.candidates] == [
        "project/interface.json"
    ]
    assert discovery.named_files_found == 1


def test_discovery_finds_nested_jsonc_and_skips_excluded_directories(tmp_path: Path) -> None:
    (tmp_path / "nested" / "bundle" / "pipeline").mkdir(parents=True)
    _write_interface(
        tmp_path / "nested" / "interface.jsonc",
        {
            "interface_version": 2,
            "name": "nested-project",
            "resource": [{"name": "main", "path": ["bundle"]}],
        },
        jsonc=True,
    )
    _write_interface(
        tmp_path / "ignored" / "interface.json",
        {
            "interface_version": 2,
            "name": "ignored",
            "resource": [{"name": "main", "path": ["bundle"]}],
        },
    )
    _write_interface(
        tmp_path / ".hidden" / "interface.json",
        {
            "interface_version": 2,
            "name": "hidden",
            "resource": [{"name": "main", "path": ["bundle"]}],
        },
    )

    discovery = discover_interfaces(tmp_path.resolve(), {"ignored"})

    assert [item.relative_path for item in discovery.candidates] == [
        "nested/interface.jsonc"
    ]
    assert discovery.named_files_found == 1


def test_discovery_reports_parse_and_version_errors(tmp_path: Path) -> None:
    (tmp_path / "broken" / "interface.json").parent.mkdir(parents=True)
    (tmp_path / "broken" / "interface.json").write_text("{ broken", encoding="utf-8")
    _write_interface(
        tmp_path / "old" / "interface.json",
        {
            "interface_version": 1,
            "resource": [{"path": ["resource"]}],
        },
    )

    discovery = discover_interfaces(tmp_path.resolve(), set())

    assert discovery.candidates == []
    assert discovery.named_files_found == 2
    assert {item.code for item in discovery.diagnostics} == {
        "interface_parse_failed",
        "interface_version_unsupported",
    }


def test_bundle_paths_merge_in_declaration_order_and_skip_invalid_paths(
    tmp_path: Path,
) -> None:
    project = tmp_path / "project"
    for name in ("base", "locale", "controller"):
        (project / name / "pipeline").mkdir(parents=True)
    _write_interface(
        project / "interface.json",
        {
            "interface_version": 2,
            "name": "ordered",
            "resource": [
                {
                    "name": "main",
                    "path": ["base", "missing", "locale", str(project / "base")],
                },
                {"name": "shared", "path": ["base"]},
            ],
            "controller": [
                {
                    "name": "desktop",
                    "attach_resource_path": ["controller", "base", "../../outside"],
                }
            ],
        },
    )

    discovery = discover_interfaces(tmp_path.resolve(), set())

    assert len(discovery.candidates) == 1
    candidate = discovery.candidates[0]
    assert [bundle.relative_path for bundle in candidate.bundles] == [
        "project/base",
        "project/locale",
        "project/controller",
    ]
    assert [source.dump() for source in candidate.bundles[0].sources] == [
        {"kind": "resource", "name": "main"},
        {"kind": "resource", "name": "shared"},
        {"kind": "controller", "name": "desktop"},
    ]
    assert {item.code for item in candidate.diagnostics} == {
        "bundle_path_missing",
        "bundle_path_not_relative",
        "bundle_path_outside_root",
    }


def test_interface_requires_a_resource_path_within_root(tmp_path: Path) -> None:
    project = tmp_path / "project"
    _write_interface(
        project / "interface.json",
        {
            "interface_version": 2,
            "resource": [{"path": ["../../outside", str(tmp_path)]}],
        },
    )

    discovery = discover_interfaces(tmp_path.resolve(), set())

    assert discovery.candidates == []
    assert {item.code for item in discovery.diagnostics} == {
        "bundle_path_not_relative",
        "bundle_path_outside_root",
        "interface_resource_missing",
    }


def test_interface_symlink_outside_root_is_rejected_without_aborting_discovery(
    tmp_path: Path,
) -> None:
    root = tmp_path / "workspace"
    root.mkdir()
    outside = tmp_path / "interface.json"
    _write_interface(
        outside,
        {
            "interface_version": 2,
            "resource": [{"path": ["resource"]}],
        },
    )
    link = root / "interface.json"
    try:
        link.symlink_to(outside)
    except OSError:
        pytest.skip("当前环境不允许创建符号链接")

    discovery = discover_interfaces(root.resolve(), set())

    assert discovery.candidates == []
    assert [item.code for item in discovery.diagnostics] == [
        "interface_path_outside_root"
    ]


def test_json_parser_uses_standard_json_before_jsonc_fallback(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    standard = tmp_path / "standard.json"
    standard.write_text('{"value": 1}', encoding="utf-8")

    def fail_jsonc(_: str) -> object:
        raise AssertionError("标准 JSON 不应调用 JSONC 解析器")

    monkeypatch.setattr("mpe_localbridge.project_interface.json5.loads", fail_jsonc)
    assert load_json_or_jsonc(standard) == {"value": 1}


def test_workspace_preferences_are_keyed_by_normalized_root(tmp_path: Path) -> None:
    preferences = WorkspacePreferences(tmp_path / "workspace-preferences.json")
    root = tmp_path / "workspace"
    root.mkdir()

    preferences.set_selected_interface(root / ".", "nested/interface.json")

    assert preferences.selected_interface(root.resolve()) == "nested/interface.json"
    document = json.loads(preferences.path.read_text(encoding="utf-8"))
    assert list(document) == ["selected_interfaces"]
