from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from threading import RLock
from typing import Any, cast

import json5

from .config import FileConfig
from .errors import ForbiddenError, InvalidArgumentError, NotFoundError

_CONFIG_SUFFIX_RE = re.compile(r"^\..+\.mpe\.json$", re.IGNORECASE)
_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}


class Workspace:
    def __init__(self, config: FileConfig) -> None:
        self.config = config
        self.root = Path(config.root).expanduser().resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self._own_writes: dict[Path, tuple[int, int, float]] = {}
        self._own_writes_lock = RLock()

    def reconfigure(self, config: FileConfig) -> None:
        self.__init__(config)

    def resolve(self, relative_path: str, *, must_exist: bool = False) -> Path:
        if not relative_path or Path(relative_path).is_absolute():
            raise InvalidArgumentError("文件路径必须是工作区相对路径")
        candidate = (self.root / relative_path).resolve(strict=must_exist)
        try:
            candidate.relative_to(self.root)
        except ValueError as error:
            raise ForbiddenError("路径超出工作区") from error
        return candidate

    def relative(self, path: Path) -> str:
        return path.resolve().relative_to(self.root).as_posix()

    def event_path(self, path: Path) -> tuple[str, bool] | None:
        try:
            resolved = path.resolve()
            relative = resolved.relative_to(self.root).as_posix()
        except (OSError, ValueError):
            return None
        is_directory = resolved.is_dir()
        if not is_directory and not self._has_allowed_extension(resolved.name):
            return None
        return relative, is_directory

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
        return fingerprint is not None and fingerprint[:2] == (stat.st_mtime_ns, stat.st_size)

    def snapshot(self) -> dict[str, Any]:
        files: list[dict[str, Any]] = []
        directories: list[str] = []
        for path in self._walk():
            relative = self.relative(path)
            if path.is_dir():
                if relative != ".":
                    directories.append(relative)
                continue
            if not self._is_pipeline_file(path):
                continue
            nodes, prefix = self._parse_nodes(path)
            files.append(
                {
                    "file_path": relative,
                    "file_name": path.name,
                    "relative_path": relative,
                    "nodes": nodes,
                    "prefix": prefix,
                }
            )
            if len(files) >= self.config.max_files:
                break
        return {
            "root": str(self.root),
            "files": sorted(files, key=lambda item: item["relative_path"].lower()),
            "directories": sorted(directories, key=str.lower),
        }

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

    def create_file(self, file_name: str, directory: str, content: Any | None) -> dict[str, Any]:
        if Path(file_name).name != file_name or not self._has_allowed_extension(file_name):
            raise InvalidArgumentError("文件名无效或扩展名不受支持")
        parent = self.root if not directory else self.resolve(directory, must_exist=True)
        path = (parent / file_name).resolve()
        try:
            path.relative_to(self.root)
        except ValueError as error:
            raise ForbiddenError("创建路径超出工作区") from error
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
        config = self._serialize_content(params.get("config"), params.get("config_json"), indent)
        self._atomic_write(pipeline_path, pipeline)
        self._atomic_write(config_path, config)
        return {
            "pipeline_path": self.relative(pipeline_path),
            "config_path": self.relative(config_path),
            "status": "ok",
        }

    def resource_bundles(self) -> dict[str, Any]:
        bundles: list[dict[str, Any]] = []
        image_dirs: list[str] = []
        candidates = [self.root]
        candidates.extend(path for path in self.root.glob("*") if path.is_dir())
        candidates.extend(path for path in self.root.glob("*/*") if path.is_dir())
        seen: set[Path] = set()
        for path in candidates:
            path = path.resolve()
            if path in seen:
                continue
            seen.add(path)
            pipeline = path / "pipeline"
            image = path / "image"
            model = path / "model"
            default_pipeline = path / "default_pipeline.json"
            if not any(item.exists() for item in (pipeline, image, model, default_pipeline)):
                continue
            rel = "" if path == self.root else self.relative(path)
            bundle = {
                "abs_path": str(path),
                "rel_path": rel,
                "name": "(root)" if path == self.root else path.name,
                "has_pipeline": pipeline.is_dir(),
                "has_image": image.is_dir(),
                "has_model": model.is_dir(),
                "has_default_pipeline": default_pipeline.is_file(),
                "image_dir": str(image) if image.is_dir() else "",
            }
            bundles.append(bundle)
            if image.is_dir():
                image_dirs.append(str(image))
        return {"root": str(self.root), "bundles": bundles, "image_dirs": image_dirs}

    def image_list(self, pipeline_path: str = "") -> dict[str, Any]:
        images: list[dict[str, str]] = []
        bundle_name = ""
        bundles = self.resource_bundles()["bundles"]
        for bundle in bundles:
            image_dir_value = bundle["image_dir"]
            if not image_dir_value:
                continue
            image_dir = Path(image_dir_value)
            if pipeline_path and not bundle_name:
                try:
                    self.resolve(pipeline_path).relative_to(Path(bundle["abs_path"]))
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
        return {"images": images, "bundle_name": bundle_name, "is_filtered": bool(bundle_name)}

    def find_image(self, relative_path: str) -> tuple[Path, str]:
        if Path(relative_path).is_absolute() or ".." in Path(relative_path).parts:
            raise InvalidArgumentError("图片路径必须是资源包内相对路径")
        for bundle in self.resource_bundles()["bundles"]:
            if not bundle["image_dir"]:
                continue
            image_dir = Path(bundle["image_dir"]).resolve()
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
        for bundle in self.resource_bundles()["bundles"]:
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

    def _walk(self) -> list[Path]:
        result: list[Path] = []
        root_depth = len(self.root.parts)
        for current, dirs, files in os.walk(self.root):
            current_path = Path(current)
            depth = len(current_path.parts) - root_depth
            dirs[:] = [
                name
                for name in dirs
                if name not in self.config.exclude
                and not name.startswith(".")
                and (self.config.max_depth == 0 or depth < self.config.max_depth)
            ]
            result.extend(current_path / name for name in dirs)
            result.extend(current_path / name for name in files)
        return result

    def _is_pipeline_file(self, path: Path) -> bool:
        return self._has_allowed_extension(path.name) and not _CONFIG_SUFFIX_RE.match(path.name)

    def _has_allowed_extension(self, name: str) -> bool:
        return Path(name).suffix.lower() in {item.lower() for item in self.config.extensions}

    def _parse_nodes(self, path: Path) -> tuple[list[dict[str, Any]], str]:
        try:
            loaded: Any = json5.loads(path.read_text(encoding="utf-8-sig"))
        except (OSError, ValueError):
            return [], ""
        content = _json_object(loaded)
        if content is None:
            return [], ""
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
        return nodes, prefix

    @staticmethod
    def _serialize_content(content: Any, content_json: Any, indent: int) -> str:
        if isinstance(content, str) and content.strip():
            return content if content.endswith("\n") else content + "\n"
        spaces = indent if indent > 0 else None
        return json.dumps(content_json, ensure_ascii=False, indent=spaces) + "\n"

    def _atomic_write(self, path: Path, content: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix(f"{path.suffix}.{os.getpid()}.tmp")
        with temp.open("w", encoding="utf-8", newline="\n") as file:
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
