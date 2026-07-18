from __future__ import annotations

from pathlib import Path

from platformdirs import user_cache_path, user_config_path, user_log_path

_APP_NAME = "MaaPipelineEditor"
_COMPONENT_NAME = "LocalBridge"


def config_path() -> Path:
    return user_config_path(_APP_NAME, appauthor=False) / _COMPONENT_NAME / "config.json"


def workspace_preferences_path() -> Path:
    return (
        user_config_path(_APP_NAME, appauthor=False)
        / _COMPONENT_NAME
        / "workspace-preferences.json"
    )


def cache_dir() -> Path:
    return user_cache_path(_APP_NAME, appauthor=False) / _COMPONENT_NAME


def log_dir() -> Path:
    return user_log_path(_APP_NAME, appauthor=False) / _COMPONENT_NAME
