from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, cast

from pydantic import BaseModel, ConfigDict, Field

from .constants import DEFAULT_ALLOWED_ORIGINS
from .paths import config_path, log_dir


class ServerConfig(BaseModel):
    host: str = "127.0.0.1"
    port: int = Field(default=9066, ge=0, le=65535)
    allowed_origins: list[str] = Field(default_factory=lambda: sorted(DEFAULT_ALLOWED_ORIGINS))


class FileConfig(BaseModel):
    root: str = "."
    exclude: list[str] = Field(
        default_factory=lambda: [
            ".git",
            ".idea",
            ".vscode",
            ".venv",
            "__pycache__",
            "node_modules",
        ]
    )
    extensions: list[str] = Field(default_factory=lambda: [".json", ".jsonc"])
    max_depth: int = Field(default=0, ge=0)
    max_files: int = Field(default=10_000, ge=1)


class LogConfig(BaseModel):
    level: str = "INFO"
    dir: str = Field(default_factory=lambda: str(log_dir()))
    push_to_client: bool = True


class MaaConfig(BaseModel):
    enabled: bool = True
    resource_dir: str = ""
    debug_mode: bool = True


class AppConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    server: ServerConfig = Field(default_factory=ServerConfig)
    file: FileConfig = Field(default_factory=FileConfig)
    log: LogConfig = Field(default_factory=LogConfig)
    maafw: MaaConfig = Field(default_factory=MaaConfig)


class ConfigStore:
    def __init__(self, path: Path | None = None) -> None:
        self.path = path or config_path()
        self._config = self._read()

    @property
    def value(self) -> AppConfig:
        return self._config

    def reload(self) -> AppConfig:
        self._config = self._read()
        return self._config

    def update(self, updates: dict[str, Any]) -> AppConfig:
        config = self._merge(updates)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temp = self.path.with_suffix(f"{self.path.suffix}.{os.getpid()}.tmp")
        temp.write_text(
            json.dumps(config.model_dump(mode="json"), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temp.replace(self.path)
        self._config = config
        return config

    def override(self, updates: dict[str, Any]) -> AppConfig:
        self._config = self._merge(updates)
        return self._config

    def _merge(self, updates: dict[str, Any]) -> AppConfig:
        merged: dict[str, Any] = self._config.model_dump(mode="json")
        _deep_merge(merged, updates)
        return AppConfig.model_validate(merged)

    def _read(self) -> AppConfig:
        if not self.path.exists():
            return AppConfig()
        return AppConfig.model_validate_json(self.path.read_text(encoding="utf-8"))


def _deep_merge(target: dict[str, Any], source: dict[str, Any]) -> None:
    for key, value in source.items():
        existing = target.get(key)
        if isinstance(existing, dict) and isinstance(value, dict):
            existing_object = _json_object(cast(dict[Any, Any], existing))
            source_object = _json_object(cast(dict[Any, Any], value))
            _deep_merge(existing_object, source_object)
            target[key] = existing_object
        else:
            target[key] = value


def _json_object(value: object) -> dict[str, Any]:
    mapping = cast(dict[Any, Any], value)
    return {str(key): item for key, item in mapping.items()}
