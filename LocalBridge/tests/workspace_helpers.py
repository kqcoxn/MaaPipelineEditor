from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from mpe_localbridge.config import FileConfig
from mpe_localbridge.workspace import Workspace


def create_project(
    root: Path,
    *,
    interface_dir: str = "project",
    resource_paths: list[str] | None = None,
    controllers: list[dict[str, Any]] | None = None,
    preferences_path: Path | None = None,
) -> Workspace:
    project = root / interface_dir
    paths = resource_paths or ["resource"]
    for resource_path in paths:
        (project / resource_path / "pipeline").mkdir(parents=True, exist_ok=True)
    interface = {
        "interface_version": 2,
        "name": project.name,
        "version": "1.0.0",
        "resource": [{"name": "main", "path": paths}],
        "controller": controllers or [],
    }
    (project / "interface.json").write_text(
        json.dumps(interface, ensure_ascii=False),
        encoding="utf-8",
    )
    workspace = Workspace(FileConfig(root=str(root)), preferences_path)
    workspace.discover()
    workspace.refresh_files()
    return workspace
