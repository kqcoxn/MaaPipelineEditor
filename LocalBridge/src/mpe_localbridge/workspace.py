from __future__ import annotations

import hashlib
import json
import logging
import mimetypes
import os
import re
import time
from pathlib import Path
from threading import RLock
from typing import Any, cast

import json5

from .config import FileConfig
from .constants import MAX_WS_MESSAGE_BYTES
from .errors import (
    DocumentConflictError,
    ForbiddenError,
    InvalidArgumentError,
    NotFoundError,
)
from .models import WorkspaceDocumentsPayload
from .paths import workspace_preferences_path
from .project_interface import (
    InterfaceCandidate,
    InterfaceDiscovery,
    WorkspacePreferences,
    discover_interfaces,
    load_json_or_jsonc,
)

_CONFIG_SUFFIX_RE = re.compile(r"(?:^|\.)mpe\.jsonc?$", re.IGNORECASE)
_PIPELINE_EXTENSIONS = {".json", ".jsonc"}
_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
_TEXT_LANGUAGES = {
    ".bat": "bat",
    ".c": "c",
    ".cc": "cpp",
    ".cfg": "ini",
    ".conf": "ini",
    ".cpp": "cpp",
    ".cs": "csharp",
    ".css": "css",
    ".env": "shell",
    ".go": "go",
    ".h": "c",
    ".hpp": "cpp",
    ".html": "html",
    ".ini": "ini",
    ".java": "java",
    ".js": "javascript",
    ".jsx": "javascript",
    ".json": "json",
    ".jsonc": "json",
    ".log": "plaintext",
    ".lua": "lua",
    ".md": "markdown",
    ".ps1": "powershell",
    ".py": "python",
    ".rs": "rust",
    ".scss": "scss",
    ".sh": "shell",
    ".sql": "sql",
    ".toml": "ini",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".txt": "plaintext",
    ".xml": "xml",
    ".yaml": "yaml",
    ".yml": "yaml",
}
LOGGER = logging.getLogger(__name__)


class Workspace:
    def __init__(
        self,
        config: FileConfig,
        preferences_path: Path | None = None,
    ) -> None:
        self.config = config
        self.root = Path(config.root).expanduser().resolve()
        self.preferences = WorkspacePreferences(
            preferences_path or workspace_preferences_path()
        )
        self._lock = RLock()
        self._own_writes: dict[Path, tuple[int, int, float]] = {}
        self._own_writes_lock = RLock()
        self._revision = 0
        self._tree_revision = 0
        self._documents_revision = 0
        self._state = "discovering"
        self._reason = ""
        self._discovery = InterfaceDiscovery([], [], 0)
        self._active: InterfaceCandidate | None = None
        self._files: dict[str, dict[str, Any]] = {}
        self._directories: list[str] = []
        self._tree_entries: list[dict[str, str]] = []
        self._documents: list[dict[str, Any]] = []
        self._index_cache: dict[
            Path,
            tuple[tuple[int, int], list[dict[str, Any]], str, str],
        ] = {}
        self._indexed_files = 0
        self._total_files = 0

    @property
    def revision(self) -> int:
        with self._lock:
            return self._revision

    @property
    def active_interface(self) -> InterfaceCandidate | None:
        with self._lock:
            return self._active

    def reconfigure(self, config: FileConfig) -> None:
        with self._lock:
            self.config = config
            self.root = Path(config.root).expanduser().resolve()
            self._revision += 1
            self._state = "discovering"
            self._reason = ""
            self._discovery = InterfaceDiscovery([], [], 0)
            self._active = None
            self._files = {}
            self._directories = []
            self._tree_entries = []
            self._documents_revision = 0
            self._documents = []
            self._indexed_files = 0
            self._total_files = 0

    def begin_discovery(self) -> dict[str, Any]:
        with self._lock:
            self._revision += 1
            self._state = "discovering"
            self._reason = ""
            self._active = None
            self._files = {}
            self._documents = []
            self._directories = []
            self._indexed_files = 0
            self._total_files = 0
        return self.status()

    def discover(self, *, prepared: bool = False) -> dict[str, Any]:
        if not prepared:
            self.begin_discovery()

        if not self.root.is_dir():
            with self._lock:
                self._discovery = InterfaceDiscovery([], [], 0)
                self._state = "invalid"
                self._reason = "root_missing"
            return self.status()

        discovery = discover_interfaces(self.root, set(self.config.exclude))
        selected: InterfaceCandidate | None = None
        remembered = self.preferences.selected_interface(self.root)
        if len(discovery.candidates) == 1:
            selected = discovery.candidates[0]
        elif remembered:
            selected = next(
                (
                    candidate
                    for candidate in discovery.candidates
                    if candidate.relative_path == remembered
                ),
                None,
            )

        with self._lock:
            self._discovery = discovery
            if selected is not None:
                self._activate(selected)
            elif discovery.candidates:
                self._state = "selection_required"
                self._reason = "multiple_interfaces"
            else:
                self._state = "invalid"
                self._reason = (
                    "interface_invalid"
                    if discovery.named_files_found
                    else "interface_not_found"
                )
        if selected is not None:
            self.preferences.set_selected_interface(self.root, selected.relative_path)
        return self.status()

    def select_interface(self, relative_path: str) -> dict[str, Any]:
        normalized = Path(relative_path).as_posix()
        with self._lock:
            selected = next(
                (
                    candidate
                    for candidate in self._discovery.candidates
                    if candidate.relative_path == normalized
                ),
                None,
            )
            if selected is None:
                raise InvalidArgumentError("Interface 不在当前候选列表中")
            self._revision += 1
            self._activate(selected)
        self.preferences.set_selected_interface(self.root, selected.relative_path)
        return self.status()

    def refresh_files(self, *, bump_revision: bool = False) -> dict[str, Any]:
        with self._lock:
            if bump_revision:
                self._revision += 1
            active = self._active
            revision = self._revision
        files: dict[str, dict[str, Any]] = {}
        directories: set[str] = set()
        if active is not None:
            for bundle in active.bundles:
                if not bundle.path.is_dir():
                    continue
                pipeline = bundle.path / "pipeline"
                if pipeline.is_dir():
                    for current, child_directories, child_files in os.walk(pipeline):
                        current_path = Path(current)
                        child_directories[:] = [
                            name for name in child_directories if not name.startswith(".")
                        ]
                        directories.add(self.relative(current_path))
                        for name in child_files:
                            path = current_path / name
                            if not self._is_pipeline_file(path):
                                continue
                            self._add_file_metadata(files, path, is_default=False)
                for name in ("default_pipeline.json", "default_pipeline.jsonc"):
                    path = bundle.path / name
                    if path.is_file():
                        self._add_file_metadata(files, path, is_default=True)
                        break

        indexed_files = sum(
            1 for item in files.values() if item["index_status"] in {"ready", "error"}
        )
        with self._lock:
            if revision != self._revision:
                return self.snapshot()
            self._files = files
            self._directories = sorted(directories, key=str.casefold)
            self._indexed_files = indexed_files
            self._total_files = len(files)
            if self._active is not None:
                self._state = "indexing" if indexed_files < len(files) else "ready"
                self._reason = ""
        return self.snapshot()

    def refresh_tree(self) -> dict[str, Any]:
        """Build a metadata-only tree without following links or reading files."""
        with self._lock:
            root = self.root
            excluded = {name.casefold() for name in self.config.exclude}

        entries: list[dict[str, str]] = []
        if root.is_dir():
            pending: list[tuple[Path, dict[str, str] | None]] = [(root, None)]
            while pending:
                current, current_entry = pending.pop()
                try:
                    children = list(os.scandir(current))
                except OSError as error:
                    LOGGER.warning("无法读取项目目录 %s: %s", current, error)
                    if current_entry is not None:
                        entries.remove(current_entry)
                    continue

                for child in children:
                    try:
                        child_path = Path(child.path)
                        if child.is_symlink():
                            continue
                        relative = child_path.relative_to(root).as_posix()
                        if child.is_dir(follow_symlinks=False):
                            if child.name.casefold() in excluded:
                                continue
                            entry = {
                                "path": relative,
                                "name": child.name,
                                "kind": "directory",
                            }
                            entries.append(entry)
                            pending.append((child_path, entry))
                        elif child.is_file(follow_symlinks=False):
                            entries.append(
                                {"path": relative, "name": child.name, "kind": "file"}
                            )
                    except (OSError, ValueError) as error:
                        LOGGER.warning("跳过项目目录项 %s: %s", child.path, error)

        entries.sort(key=lambda item: (item["path"].casefold(), item["path"]))
        with self._lock:
            current_excluded = {name.casefold() for name in self.config.exclude}
            if root != self.root or excluded != current_excluded:
                return self.tree_snapshot()
            self._tree_revision += 1
            self._tree_entries = entries
        return self.tree_snapshot()

    def refresh_documents(self) -> dict[str, Any]:
        """Classify project files from metadata without reading ordinary content."""
        with self._lock:
            root = self.root
            tree_entries = tuple(self._tree_entries)
            active = self._active
            revision = self._documents_revision + 1

        documents = [
            self._classify_document(root, active, root / entry["path"])
            for entry in tree_entries
            if entry["kind"] == "file"
        ]
        documents = [document for document in documents if document is not None]
        documents.sort(key=lambda item: (str(item["path"]).casefold(), str(item["path"])))

        with self._lock:
            if root != self.root or active is not self._active:
                return self.documents_snapshot()
            self._documents_revision = revision
            self._documents = documents
        return self.documents_snapshot()

    def refresh_modified_files(self, relative_paths: list[str]) -> dict[str, Any]:
        with self._lock:
            self._revision += 1
            revision = self._revision
            current_files = dict(self._files)
            for relative_path in relative_paths:
                self._index_cache.pop((self.root / relative_path).resolve(), None)

        for relative_path in dict.fromkeys(relative_paths):
            if relative_path not in current_files:
                continue
            try:
                path = self.resolve(relative_path, must_exist=True)
            except (ForbiddenError, InvalidArgumentError, NotFoundError, OSError):
                continue
            metadata: dict[str, dict[str, Any]] = {}
            self._add_file_metadata(
                metadata,
                path,
                is_default=bool(current_files[relative_path].get("is_default_pipeline")),
            )
            if relative_path in metadata:
                current_files[relative_path] = metadata[relative_path]

        with self._lock:
            if revision != self._revision:
                return self.snapshot()
            self._files = current_files
            self._indexed_files = sum(
                1
                for item in current_files.values()
                if item["index_status"] in {"ready", "error"}
            )
            self._total_files = len(current_files)
            if self._active is not None:
                self._state = (
                    "indexing" if self._indexed_files < self._total_files else "ready"
                )
                self._reason = ""
        return self.snapshot()

    def tracks_files(self, relative_paths: list[str]) -> bool:
        with self._lock:
            return all(relative_path in self._files for relative_path in relative_paths)

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            active = self._active
            return {
                "revision": self._revision,
                "root": str(self.root),
                "interface_path": active.relative_path if active else "",
                "files": sorted(
                    (dict(item) for item in self._files.values()),
                    key=lambda item: str(item["relative_path"]).casefold(),
                ),
                "directories": list(self._directories),
            }

    def tree_snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "revision": self._tree_revision,
                "root": str(self.root),
                "entries": [dict(entry) for entry in self._tree_entries],
            }

    def documents_snapshot(self) -> dict[str, Any]:
        with self._lock:
            payload = WorkspaceDocumentsPayload.model_validate(
                {
                    "revision": self._documents_revision,
                    "root": str(self.root),
                    "documents": self._documents,
                }
            )
        return payload.model_dump(mode="json", by_alias=True)

    def status(self) -> dict[str, Any]:
        with self._lock:
            active = self._active
            diagnostics = list(self._discovery.diagnostics)
            if active is not None:
                diagnostics = active.diagnostics
            return {
                "revision": self._revision,
                "root": str(self.root),
                "state": self._state,
                "reason": self._reason,
                "candidates": [
                    candidate.summary() for candidate in self._discovery.candidates
                ],
                "current_interface": active.summary() if active else None,
                "indexed_files": self._indexed_files,
                "total_files": self._total_files,
                "diagnostics": [diagnostic.dump() for diagnostic in diagnostics],
            }

    def pending_index_paths(self, revision: int) -> list[str]:
        with self._lock:
            if revision != self._revision:
                return []
            return [
                relative
                for relative, item in self._files.items()
                if item["index_status"] == "pending"
            ]

    def index_file(self, revision: int, relative_path: str) -> dict[str, Any] | None:
        with self._lock:
            if revision != self._revision:
                return None
            existing = self._files.get(relative_path)
            if existing is None or existing["index_status"] != "pending":
                return None
            is_default = bool(existing.get("is_default_pipeline"))
        path = self.resolve(relative_path, must_exist=True)
        if is_default:
            nodes: list[dict[str, Any]] = []
            prefix = ""
            index_status = "ready"
        else:
            nodes, prefix, index_status = self._parse_nodes(path)
        try:
            stat = path.stat()
            fingerprint = (stat.st_mtime_ns, stat.st_size)
        except OSError:
            return None

        with self._lock:
            if revision != self._revision or relative_path not in self._files:
                return None
            item = self._files[relative_path]
            item["nodes"] = nodes
            item["prefix"] = prefix
            item["index_status"] = index_status
            self._index_cache[path] = (fingerprint, nodes, prefix, index_status)
            self._indexed_files = sum(
                1
                for value in self._files.values()
                if value["index_status"] in {"ready", "error"}
            )
            if self._indexed_files >= self._total_files:
                self._state = "ready"
            return {
                "revision": revision,
                "files": [dict(item)],
                "indexed_files": self._indexed_files,
                "total_files": self._total_files,
                "complete": self._indexed_files >= self._total_files,
            }

    def resolve(self, relative_path: str, *, must_exist: bool = False) -> Path:
        if not relative_path or Path(relative_path).is_absolute():
            raise InvalidArgumentError("文件路径必须是工作区相对路径")
        candidate = (self.root / relative_path).resolve(strict=must_exist)
        try:
            candidate.relative_to(self.root)
        except ValueError as error:
            raise ForbiddenError("路径超出工作区") from error
        return candidate

    def document_descriptor(self, relative_path: str) -> dict[str, Any]:
        path = self._resolve_document_path(relative_path)
        if not path.is_file():
            raise NotFoundError("文件不存在")
        with self._lock:
            descriptor = next(
                (
                    dict(document)
                    for document in self._documents
                    if document["path"] == relative_path
                ),
                None,
            )
        if descriptor is None:
            raise NotFoundError("文件不存在或不可访问")
        return descriptor

    def open_document(self, relative_path: str) -> dict[str, Any]:
        descriptor = self.document_descriptor(relative_path)
        path = self._resolve_document_path(relative_path)
        revision = _sha256_path(path)
        result = {
            **descriptor,
            "revision": revision,
        }
        if descriptor["kind"] in {"image", "binary"}:
            return {**result, "_path": path}
        if path.stat().st_size >= MAX_WS_MESSAGE_BYTES:
            return {
                **result,
                "editable": False,
                "previewable": True,
                "read_only_reason": "too_large",
                "_path": path,
            }
        raw = path.read_bytes()
        try:
            result["content"] = raw.decode("utf-8-sig")
            result["encoding"] = "utf-8"
        except UnicodeDecodeError:
            result["kind"] = "binary"
            result["language"] = ""
            result["mime_type"] = "application/octet-stream"
            result["editable"] = False
            result["previewable"] = True
            result["read_only_reason"] = "binary"
        return {**result, "_path": path}

    def save_document(
        self,
        relative_path: str,
        content: str,
        base_revision: str,
    ) -> dict[str, Any]:
        descriptor = self.document_descriptor(relative_path)
        if not descriptor["editable"] or descriptor["kind"] in {"image", "binary"}:
            raise ForbiddenError("该文件不支持文本编辑")
        path = self._resolve_document_path(relative_path)
        current = path.read_bytes()
        try:
            current.decode("utf-8-sig")
        except UnicodeDecodeError as error:
            raise ForbiddenError("该文件不是可安全编辑的 UTF-8 文本") from error
        current_revision = hashlib.sha256(current).hexdigest()
        if current_revision != base_revision:
            raise DocumentConflictError(
                "文件已被外部修改",
                data={
                    "path": relative_path,
                    "currentRevision": current_revision,
                },
            )
        encoded = content.encode("utf-8")
        if len(encoded) >= MAX_WS_MESSAGE_BYTES:
            raise InvalidArgumentError("文件内容超过 WebSocket 消息限制")
        self._atomic_write_bytes(path, encoded)
        revision = hashlib.sha256(encoded).hexdigest()
        return {
            "path": relative_path,
            "revision": revision,
            "size": len(encoded),
            "sha256": revision,
        }

    def _resolve_document_path(self, relative_path: str) -> Path:
        lexical = self.root / relative_path
        normalized = self._lexical_relative(lexical)
        if not normalized or normalized != Path(relative_path).as_posix():
            raise InvalidArgumentError("文件路径必须是规范的工作区相对路径")
        if self._has_symlink_ancestor(normalized):
            raise ForbiddenError("不允许访问符号链接")
        with self._lock:
            excluded = {name.casefold() for name in self.config.exclude}
        if any(part.casefold() in excluded for part in Path(normalized).parts):
            raise ForbiddenError("文件位于已排除目录")
        return self.resolve(normalized, must_exist=True)

    def _classify_document(
        self,
        root: Path,
        active: InterfaceCandidate | None,
        path: Path | None = None,
    ) -> dict[str, Any] | None:
        candidate = path or root
        try:
            resolved = candidate.resolve(strict=True)
            relative = resolved.relative_to(root.resolve()).as_posix()
            stat = resolved.stat()
        except (OSError, ValueError):
            return None
        if not resolved.is_file() or candidate.is_symlink():
            return None

        suffix = resolved.suffix.casefold()
        name = resolved.name
        language = _TEXT_LANGUAGES.get(name.casefold(), _TEXT_LANGUAGES.get(suffix, ""))
        mime_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
        role: str | None = None

        is_interface = bool(
            active is not None
            and (resolved == active.path or resolved in active.imports)
        )
        is_default_pipeline = bool(
            active is not None
            and any(
                resolved == bundle.path / default_name
                for bundle in active.bundles
                for default_name in ("default_pipeline.json", "default_pipeline.jsonc")
            )
        )
        is_pipeline = bool(
            active is not None
            and any(
                _path_is_relative_to(resolved, bundle.path / "pipeline")
                and self._is_pipeline_file(resolved)
                for bundle in active.bundles
            )
        )

        if is_interface:
            kind = "interface"
            language = "json"
            mime_type = "application/json"
        elif is_pipeline:
            kind = "pipeline"
            language = "json"
            mime_type = "application/json"
        elif is_default_pipeline:
            kind = "json"
            role = "default_pipeline"
            language = "json"
            mime_type = "application/json"
        elif suffix in _PIPELINE_EXTENSIONS:
            kind = "json"
            language = "json"
            mime_type = "application/json"
            if _CONFIG_SUFFIX_RE.search(name):
                role = "mpe_config"
        elif suffix in _IMAGE_EXTENSIONS:
            kind = "image"
        elif suffix == ".md":
            kind = "markdown"
            mime_type = "text/markdown"
        elif language:
            kind = "text"
            mime_type = mime_type if mime_type.startswith("text/") else "text/plain"
        else:
            kind = "binary"

        editable = kind in {"interface", "json", "text", "markdown"}
        previewable = True
        read_only_reason: str | None = None
        if kind == "pipeline":
            read_only_reason = "pipeline"
        elif kind == "image":
            editable = False
            read_only_reason = "image"
        elif kind == "binary":
            editable = False
            read_only_reason = "binary"
        elif stat.st_size >= MAX_WS_MESSAGE_BYTES:
            editable = False
            read_only_reason = "too_large"

        return {
            "path": relative,
            "name": name,
            "kind": kind,
            "language": language,
            "mime_type": mime_type,
            "size": stat.st_size,
            "editable": editable,
            "previewable": previewable,
            "read_only_reason": read_only_reason,
            "role": role,
        }

    def relative(self, path: Path) -> str:
        return path.resolve().relative_to(self.root).as_posix()

    def change_kind(self, path: Path) -> str | None:
        relative = self._lexical_relative(path)
        if relative is None:
            return None
        if self._has_symlink_ancestor(relative):
            return None
        try:
            resolved = path.resolve()
            resolved.relative_to(self.root)
        except (OSError, ValueError):
            return None
        with self._lock:
            candidates = tuple(self._discovery.candidates)
            active = self._active
            tree_kinds = {
                entry["path"]: entry["kind"] for entry in self._tree_entries
            }
            excluded = {name.casefold() for name in self.config.exclude}

        if any(part.casefold() in excluded for part in Path(relative).parts):
            return None
        if path.name.casefold() in {"interface.json", "interface.jsonc"}:
            return "interface"
        if any(resolved in candidate.imports for candidate in candidates):
            return "interface"
        if active is None:
            return "project" if path.exists() or relative in tree_kinds else None
        for bundle in active.bundles:
            pipeline = bundle.path / "pipeline"
            try:
                resolved.relative_to(pipeline)
                relative = resolved.relative_to(self.root).as_posix()
                with self._lock:
                    known_directory = relative in self._directories
                if path.is_dir() or known_directory or self._is_pipeline_file(path):
                    return "pipeline"
                return "project" if path.exists() or relative in tree_kinds else None
            except ValueError:
                pass
            if resolved.parent == bundle.path and resolved.name.casefold() in {
                "default_pipeline.json",
                "default_pipeline.jsonc",
            }:
                return "pipeline"
        return "project" if path.exists() or relative in tree_kinds else None

    def event_path(self, path: Path) -> tuple[str, bool] | None:
        kind = self.change_kind(path)
        if kind is None:
            return None
        relative = self._lexical_relative(path)
        if relative is None:
            return None
        with self._lock:
            known_directory = relative in self._directories
            tree_kind = next(
                (
                    entry["kind"]
                    for entry in self._tree_entries
                    if entry["path"] == relative
                ),
                None,
            )
        return relative, path.is_dir() or known_directory or tree_kind == "directory"

    def _lexical_relative(self, path: Path) -> str | None:
        lexical = Path(os.path.abspath(path))
        try:
            return lexical.relative_to(self.root).as_posix()
        except ValueError:
            return None

    def _has_symlink_ancestor(self, relative: str) -> bool:
        current = self.root
        for part in Path(relative).parts:
            current /= part
            try:
                if current.is_symlink():
                    return True
            except OSError:
                return True
        return False

    def is_own_write(self, path: Path) -> bool:
        try:
            resolved = path.resolve()
            stat = resolved.stat()
        except OSError:
            return False
        now = time.monotonic()
        with self._own_writes_lock:
            expired = [
                candidate
                for candidate, (_, _, expires_at) in self._own_writes.items()
                if expires_at < now
            ]
            for candidate in expired:
                self._own_writes.pop(candidate, None)
            fingerprint = self._own_writes.get(resolved)
        return fingerprint is not None and fingerprint[:2] == (
            stat.st_mtime_ns,
            stat.st_size,
        )

    def open_file(self, relative_path: str) -> dict[str, Any]:
        path = self.resolve(relative_path, must_exist=True)
        if not path.is_file():
            raise NotFoundError("文件不存在")
        text = path.read_text(encoding="utf-8-sig")
        try:
            content = json5.loads(text)
        except ValueError as error:
            raise InvalidArgumentError(f"JSON/JSONC 解析失败: {error}") from error

        config_path = self._separated_config_path(path)
        mpe_config: Any | None = None
        config_relative = ""
        if config_path.is_file():
            try:
                mpe_config = json5.loads(config_path.read_text(encoding="utf-8-sig"))
                config_relative = self.relative(config_path)
            except ValueError as error:
                raise InvalidArgumentError(f"MPE 配置解析失败: {error}") from error
        return {
            "file_path": self.relative(path),
            "content": content,
            "mpe_config": mpe_config,
            "config_path": config_relative,
        }

    def create_file(
        self,
        file_name: str,
        directory: str,
        content: Any | None,
    ) -> dict[str, Any]:
        if Path(file_name).name != file_name or not self._is_pipeline_file(Path(file_name)):
            raise InvalidArgumentError("文件名无效或扩展名不受支持")
        if not directory:
            raise InvalidArgumentError("必须选择 Pipeline 目录")
        parent = self.resolve(directory, must_exist=True)
        if not parent.is_dir() or not self._is_pipeline_directory(parent):
            raise ForbiddenError("文件只能创建在所选项目的 Pipeline 目录中")
        path = (parent / file_name).resolve()
        if path.exists():
            raise InvalidArgumentError("文件已存在")
        self._atomic_write(path, json.dumps(content or {}, ensure_ascii=False, indent=4) + "\n")
        return {"file_path": self.relative(path), "status": "ok"}

    def save_file(
        self,
        relative_path: str,
        content: str | None,
        content_json: Any,
        indent: int,
    ) -> dict[str, Any]:
        path = self.resolve(relative_path)
        serialized = self._serialize_content(content, content_json, indent)
        self._atomic_write(path, serialized)
        return {"file_path": self.relative(path), "status": "ok"}

    def save_separated(self, params: dict[str, Any]) -> dict[str, Any]:
        pipeline_path = self.resolve(str(params.get("pipeline_path", "")))
        config_path = self.resolve(str(params.get("config_path", "")))
        indent = int(params.get("indent", 0))
        pipeline = self._serialize_content(
            params.get("pipeline"), params.get("pipeline_json"), indent
        )
        config = self._serialize_content(
            params.get("config"), params.get("config_json"), indent
        )
        self._atomic_write(pipeline_path, pipeline)
        self._atomic_write(config_path, config)
        return {
            "pipeline_path": self.relative(pipeline_path),
            "config_path": self.relative(config_path),
            "status": "ok",
        }

    def resource_bundles(self) -> dict[str, Any]:
        with self._lock:
            active = self._active
            revision = self._revision
        bundles = [bundle.dump(self.root) for bundle in active.bundles] if active else []
        image_dirs = [
            str(bundle["image_dir"])
            for bundle in bundles
            if bundle.get("image_dir")
        ]
        return {
            "revision": revision,
            "root": str(self.root),
            "interface_path": active.relative_path if active else "",
            "bundles": bundles,
            "image_dirs": image_dirs,
        }

    def image_list(self, pipeline_path: str = "") -> dict[str, Any]:
        images: list[dict[str, str]] = []
        bundle_name = ""
        bundles = cast(list[dict[str, Any]], self.resource_bundles()["bundles"])
        for bundle in bundles:
            image_dir_value = str(bundle["image_dir"])
            if not image_dir_value:
                continue
            image_dir = Path(image_dir_value)
            if pipeline_path and not bundle_name:
                try:
                    self.resolve(pipeline_path).relative_to(Path(str(bundle["abs_path"])))
                    bundle_name = str(bundle["name"])
                except ValueError:
                    pass
            for path in image_dir.rglob("*"):
                if path.is_file() and path.suffix.lower() in _IMAGE_EXTENSIONS:
                    images.append(
                        {
                            "relative_path": path.relative_to(image_dir).as_posix(),
                            "bundle_name": str(bundle["name"]),
                        }
                    )
        return {
            "images": images,
            "bundle_name": bundle_name,
            "is_filtered": bool(bundle_name),
        }

    def find_image(self, relative_path: str) -> tuple[Path, str]:
        if Path(relative_path).is_absolute() or ".." in Path(relative_path).parts:
            raise InvalidArgumentError("图片路径必须是资源包内相对路径")
        bundles = cast(list[dict[str, Any]], self.resource_bundles()["bundles"])
        for bundle in bundles:
            image_dir_value = str(bundle["image_dir"])
            if not image_dir_value:
                continue
            image_dir = Path(image_dir_value).resolve()
            path = (image_dir / relative_path).resolve()
            try:
                path.relative_to(image_dir)
            except ValueError:
                continue
            if path.is_file():
                return path, str(bundle["name"])
        raise NotFoundError("图片不存在")

    def resolve_image_name(self, file_name: str) -> dict[str, Any]:
        if not file_name or Path(file_name).name != file_name:
            raise InvalidArgumentError("图片名称必须是不含目录的文件名")
        matches: list[tuple[int, Path, Path]] = []
        bundles = cast(list[dict[str, Any]], self.resource_bundles()["bundles"])
        for bundle in bundles:
            image_dir_value = str(bundle["image_dir"])
            if not image_dir_value:
                continue
            image_dir = Path(image_dir_value).resolve()
            for path in image_dir.rglob(file_name):
                resolved = path.resolve()
                try:
                    resolved.relative_to(image_dir)
                except ValueError:
                    continue
                if resolved.is_file():
                    matches.append((resolved.stat().st_mtime_ns, resolved, image_dir))
        if not matches:
            raise NotFoundError("未找到图片, 请手动输入路径")
        _, path, image_dir = max(
            matches,
            key=lambda item: (item[0], str(item[1]).casefold()),
        )
        return {
            "success": True,
            "relative_path": path.relative_to(image_dir).as_posix(),
            "absolute_path": str(path),
            "message": "ok",
        }

    def _activate(self, candidate: InterfaceCandidate) -> None:
        self._active = candidate
        self._state = "indexing"
        self._reason = ""
        self._files = {}
        self._directories = []
        self._indexed_files = 0
        self._total_files = 0

    def _add_file_metadata(
        self,
        target: dict[str, dict[str, Any]],
        path: Path,
        *,
        is_default: bool,
    ) -> None:
        resolved = path.resolve()
        relative = self.relative(resolved)
        try:
            stat = resolved.stat()
        except OSError:
            return
        fingerprint = (stat.st_mtime_ns, stat.st_size)
        cached = self._index_cache.get(resolved)
        if is_default:
            nodes: list[dict[str, Any]] = []
            prefix = ""
            index_status = "ready"
        elif cached is not None and cached[0] == fingerprint:
            nodes = cached[1]
            prefix = cached[2]
            index_status = cached[3]
        else:
            nodes = []
            prefix = ""
            index_status = "pending"
        target[relative] = {
            "file_path": relative,
            "file_name": resolved.name,
            "relative_path": relative,
            "nodes": nodes,
            "prefix": prefix,
            "index_status": index_status,
            "is_default_pipeline": is_default,
        }

    def _is_pipeline_directory(self, path: Path) -> bool:
        with self._lock:
            active = self._active
        if active is None:
            return False
        for bundle in active.bundles:
            pipeline = (bundle.path / "pipeline").resolve()
            try:
                path.resolve().relative_to(pipeline)
                return True
            except ValueError:
                continue
        return False

    @staticmethod
    def _is_pipeline_file(path: Path) -> bool:
        return (
            path.suffix.casefold() in _PIPELINE_EXTENSIONS
            and not path.name.startswith(".")
            and not _CONFIG_SUFFIX_RE.match(path.name)
        )

    @staticmethod
    def _parse_nodes(path: Path) -> tuple[list[dict[str, Any]], str, str]:
        try:
            loaded = load_json_or_jsonc(path)
        except (OSError, ValueError):
            return [], "", "error"
        content = _json_object(loaded)
        if content is None:
            return [], "", "error"
        mpe = _json_object(content.get("$mpe"))
        prefix = str(mpe.get("prefix", "")) if mpe is not None else ""
        nodes: list[dict[str, Any]] = []
        for label, value in content.items():
            if str(label).startswith("$"):
                continue
            anchors: list[str] = []
            node = _json_object(value)
            if node is not None:
                raw = node.get("anchor")
                if isinstance(raw, str) and raw:
                    anchors = [raw]
                elif isinstance(raw, list):
                    anchors = [str(item) for item in cast(list[Any], raw) if item]
                else:
                    raw_object = _json_object(raw)
                    if raw_object is not None:
                        anchors = [str(item) for item in raw_object if item]
            nodes.append({"label": str(label), "prefix": prefix, "anchors": anchors})
        return nodes, prefix, "ready"

    @staticmethod
    def _serialize_content(content: Any, content_json: Any, indent: int) -> str:
        if isinstance(content, str) and content.strip():
            return content if content.endswith("\n") else content + "\n"
        spaces = indent if indent > 0 else None
        return json.dumps(content_json, ensure_ascii=False, indent=spaces) + "\n"

    def _atomic_write(self, path: Path, content: str) -> None:
        self._atomic_write_bytes(path, content.encode("utf-8"))

    def _atomic_write_bytes(self, path: Path, content: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix(f"{path.suffix}.{os.getpid()}.tmp")
        with temp.open("wb") as file:
            file.write(content)
            file.flush()
            os.fsync(file.fileno())
        temp.replace(path)
        stat = path.stat()
        with self._own_writes_lock:
            self._own_writes[path.resolve()] = (
                stat.st_mtime_ns,
                stat.st_size,
                time.monotonic() + 2.0,
            )

    @staticmethod
    def _separated_config_path(path: Path) -> Path:
        return path.with_name(f".{path.stem}.mpe.json")


def _json_object(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    mapping = cast(dict[Any, Any], value)
    return {str(key): item for key, item in mapping.items()}


def _path_is_relative_to(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent.resolve())
        return True
    except (OSError, ValueError):
        return False


def _sha256_path(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        while chunk := file.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()
