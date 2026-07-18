from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, cast

import json5


@dataclass(frozen=True, slots=True)
class WorkspaceDiagnostic:
    code: str
    message: str
    path: str = ""
    severity: str = "warning"

    def dump(self) -> dict[str, str]:
        return {
            "code": self.code,
            "message": self.message,
            "path": self.path,
            "severity": self.severity,
        }


@dataclass(frozen=True, slots=True)
class BundleSource:
    kind: str
    name: str

    def dump(self) -> dict[str, str]:
        return {"kind": self.kind, "name": self.name}


@dataclass(slots=True)
class ProjectBundle:
    path: Path
    relative_path: str
    sources: list[BundleSource] = field(default_factory=lambda: list[BundleSource]())

    def dump(self, root: Path) -> dict[str, Any]:
        pipeline = self.path / "pipeline"
        image = self.path / "image"
        model = self.path / "model"
        default_pipeline = _default_pipeline_path(self.path)
        return {
            "abs_path": str(self.path),
            "rel_path": self.relative_path,
            "name": self.path.name,
            "has_pipeline": pipeline.is_dir(),
            "has_image": image.is_dir(),
            "has_model": model.is_dir(),
            "has_default_pipeline": default_pipeline is not None,
            "image_dir": str(image) if image.is_dir() else "",
            "sources": [source.dump() for source in self.sources],
            "pipeline_path": _relative_to_root(pipeline, root) if pipeline.is_dir() else "",
        }


@dataclass(slots=True)
class InterfaceCandidate:
    path: Path
    relative_path: str
    name: str
    label: str
    version: str
    bundles: list[ProjectBundle]
    imports: set[Path]
    diagnostics: list[WorkspaceDiagnostic]

    def summary(self) -> dict[str, str]:
        return {
            "interface_path": self.relative_path,
            "name": self.name,
            "label": self.label,
            "version": self.version,
        }


@dataclass(slots=True)
class InterfaceDiscovery:
    candidates: list[InterfaceCandidate]
    diagnostics: list[WorkspaceDiagnostic]
    named_files_found: int


class WorkspacePreferences:
    def __init__(self, path: Path) -> None:
        self.path = path

    def selected_interface(self, root: Path) -> str | None:
        document = self._read()
        selections = document.get("selected_interfaces")
        if not isinstance(selections, dict):
            return None
        value = cast(dict[Any, Any], selections).get(_root_key(root))
        return str(value) if isinstance(value, str) and value else None

    def set_selected_interface(self, root: Path, interface_path: str) -> None:
        document = self._read()
        raw_selections = document.get("selected_interfaces")
        selections = (
            {str(key): value for key, value in cast(dict[Any, Any], raw_selections).items()}
            if isinstance(raw_selections, dict)
            else {}
        )
        selections[_root_key(root)] = interface_path
        document["selected_interfaces"] = selections
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temp = self.path.with_suffix(f"{self.path.suffix}.{os.getpid()}.tmp")
        temp.write_text(
            json.dumps(document, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temp.replace(self.path)

    def _read(self) -> dict[str, Any]:
        try:
            loaded = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}
        if not isinstance(loaded, dict):
            return {}
        return {str(key): value for key, value in cast(dict[Any, Any], loaded).items()}


def discover_interfaces(
    root: Path,
    excluded_directories: set[str],
) -> InterfaceDiscovery:
    root = root.resolve()
    candidates: list[InterfaceCandidate] = []
    diagnostics: list[WorkspaceDiagnostic] = []
    named_files_found = 0
    if not root.is_dir():
        return InterfaceDiscovery(candidates, diagnostics, named_files_found)

    excluded = {name.casefold() for name in excluded_directories}
    for current, directories, files in os.walk(root, followlinks=False):
        current_path = Path(current)
        directories[:] = [
            name
            for name in directories
            if not name.startswith(".") and name.casefold() not in excluded
        ]
        for name in files:
            if name.casefold() not in {"interface.json", "interface.jsonc"}:
                continue
            named_files_found += 1
            path = current_path / name
            candidate, candidate_diagnostics = _parse_candidate(path, root)
            diagnostics.extend(candidate_diagnostics)
            if candidate is not None:
                candidates.append(candidate)

    candidates.sort(key=lambda item: item.relative_path.casefold())
    return InterfaceDiscovery(candidates, diagnostics, named_files_found)


def load_json_or_jsonc(path: Path) -> Any:
    text = path.read_text(encoding="utf-8-sig")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return json5.loads(text)


def _parse_candidate(
    path: Path,
    root: Path,
) -> tuple[InterfaceCandidate | None, list[WorkspaceDiagnostic]]:
    diagnostics: list[WorkspaceDiagnostic] = []
    try:
        resolved_path = path.resolve(strict=True)
        relative_path = resolved_path.relative_to(root).as_posix()
    except (OSError, ValueError):
        return None, [
            WorkspaceDiagnostic(
                code="interface_path_outside_root",
                message="Interface 路径超出启动根目录",
                path=_lexical_relative(path, root),
                severity="error",
            )
        ]
    try:
        loaded = load_json_or_jsonc(resolved_path)
    except (OSError, ValueError) as error:
        return None, [
            WorkspaceDiagnostic(
                code="interface_parse_failed",
                message=f"Interface 解析失败: {error}",
                path=relative_path,
                severity="error",
            )
        ]
    document = _json_object(loaded)
    if document is None:
        return None, [
            WorkspaceDiagnostic(
                code="interface_invalid",
                message="Interface 根节点必须是对象",
                path=relative_path,
                severity="error",
            )
        ]
    if document.get("interface_version") != 2:
        return None, [
            WorkspaceDiagnostic(
                code="interface_version_unsupported",
                message="仅支持 interface_version = 2",
                path=relative_path,
                severity="error",
            )
        ]

    interface_dir = resolved_path.parent
    bundle_map: dict[Path, ProjectBundle] = {}
    declared_resource_paths = 0
    resources = document.get("resource")
    if isinstance(resources, list):
        for index, raw_resource in enumerate(cast(list[Any], resources)):
            resource = _json_object(raw_resource)
            if resource is None:
                continue
            resource_name = _display_name(resource, f"resource[{index}]")
            paths = resource.get("path")
            if not isinstance(paths, list):
                continue
            for raw_path in cast(list[Any], paths):
                if not isinstance(raw_path, str) or not raw_path.strip():
                    continue
                if _add_bundle(
                    bundle_map,
                    raw_path.strip(),
                    BundleSource("resource", resource_name),
                    interface_dir,
                    root,
                    relative_path,
                    diagnostics,
                ):
                    declared_resource_paths += 1

    if declared_resource_paths == 0:
        return None, [
            *diagnostics,
            WorkspaceDiagnostic(
                code="interface_resource_missing",
                message="Interface 未声明合法的 resource[].path",
                path=relative_path,
                severity="error",
            ),
        ]

    controllers = document.get("controller")
    if isinstance(controllers, list):
        for index, raw_controller in enumerate(cast(list[Any], controllers)):
            controller = _json_object(raw_controller)
            if controller is None:
                continue
            controller_name = _display_name(controller, f"controller[{index}]")
            attached = controller.get("attach_resource_path")
            if not isinstance(attached, list):
                continue
            for raw_path in cast(list[Any], attached):
                if not isinstance(raw_path, str) or not raw_path.strip():
                    continue
                _add_bundle(
                    bundle_map,
                    raw_path.strip(),
                    BundleSource("controller", controller_name),
                    interface_dir,
                    root,
                    relative_path,
                    diagnostics,
                )

    imports: set[Path] = set()
    raw_imports = document.get("import")
    if isinstance(raw_imports, list):
        for raw_import in cast(list[Any], raw_imports):
            if not isinstance(raw_import, str) or not raw_import.strip():
                continue
            imported = (interface_dir / raw_import).resolve()
            try:
                imported.relative_to(root)
            except ValueError:
                diagnostics.append(
                    WorkspaceDiagnostic(
                        code="interface_import_outside_root",
                        message=f"Interface import 超出启动根目录: {raw_import}",
                        path=relative_path,
                    )
                )
                continue
            imports.add(imported)

    project_name = str(document.get("name") or resolved_path.parent.name)
    raw_label = document.get("label")
    label = (
        str(raw_label)
        if isinstance(raw_label, str) and not raw_label.startswith("$")
        else project_name
    )
    candidate = InterfaceCandidate(
        path=resolved_path,
        relative_path=relative_path,
        name=project_name,
        label=label,
        version=str(document.get("version") or ""),
        bundles=list(bundle_map.values()),
        imports=imports,
        diagnostics=diagnostics,
    )
    return candidate, diagnostics


def _add_bundle(
    bundles: dict[Path, ProjectBundle],
    declared_path: str,
    source: BundleSource,
    interface_dir: Path,
    root: Path,
    interface_path: str,
    diagnostics: list[WorkspaceDiagnostic],
) -> bool:
    if Path(declared_path).is_absolute():
        diagnostics.append(
            WorkspaceDiagnostic(
                code="bundle_path_not_relative",
                message=f"资源路径必须相对于 Interface: {declared_path}",
                path=interface_path,
                severity="error",
            )
        )
        return False
    path = (interface_dir / declared_path).resolve()
    try:
        path.relative_to(root)
    except ValueError:
        diagnostics.append(
            WorkspaceDiagnostic(
                code="bundle_path_outside_root",
                message=f"资源路径超出启动根目录: {declared_path}",
                path=interface_path,
                severity="error",
            )
        )
        return False
    if not path.is_dir():
        diagnostics.append(
            WorkspaceDiagnostic(
                code="bundle_path_missing",
                message=f"资源路径不存在: {declared_path}",
                path=interface_path,
            )
        )
        return True
    bundle = bundles.get(path)
    if bundle is None:
        bundle = ProjectBundle(path, _relative_to_root(path, root))
        bundles[path] = bundle
    if source not in bundle.sources:
        bundle.sources.append(source)
    return True


def _default_pipeline_path(bundle: Path) -> Path | None:
    for name in ("default_pipeline.json", "default_pipeline.jsonc"):
        path = bundle / name
        if path.is_file():
            return path
    return None


def _display_name(document: dict[str, Any], fallback: str) -> str:
    name = document.get("name")
    return str(name) if isinstance(name, str) and name else fallback


def _json_object(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    return {str(key): item for key, item in cast(dict[Any, Any], value).items()}


def _relative_to_root(path: Path, root: Path) -> str:
    return path.resolve().relative_to(root).as_posix()


def _root_key(root: Path) -> str:
    return os.path.normcase(str(root.resolve()))


def _lexical_relative(path: Path, root: Path) -> str:
    try:
        return path.absolute().relative_to(root).as_posix()
    except ValueError:
        return str(path)
