from __future__ import annotations

import argparse
import json
from pathlib import Path

import pytest
from pytest import MonkeyPatch

from mpe_localbridge import cli
from mpe_localbridge.cli import main


def run_config(*arguments: str) -> None:
    with pytest.raises(SystemExit) as exit_info:
        main(["config", *arguments])
    assert exit_info.value.code == 0


def test_config_set_get_and_show(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    config_path = tmp_path / "config.json"

    run_config("--config", str(config_path), "set", "log.level", '"DEBUG"')
    assert json.loads(capsys.readouterr().out) == "DEBUG"

    run_config("--config", str(config_path), "get", "log.level")
    assert json.loads(capsys.readouterr().out) == "DEBUG"

    run_config("--config", str(config_path), "show")
    document = json.loads(capsys.readouterr().out)
    assert document["log"]["level"] == "DEBUG"
    assert document["server"]["host"] == "127.0.0.1"


def test_config_path_uses_explicit_file(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    config_path = tmp_path / "custom.json"

    run_config("--config", str(config_path), "path")

    assert Path(capsys.readouterr().out.strip()) == config_path


def test_empty_arguments_start_serve(monkeypatch: MonkeyPatch) -> None:
    called = False

    async def fake_serve(args: argparse.Namespace) -> None:
        nonlocal called
        called = True
        assert args.command == "serve"

    monkeypatch.setattr(cli, "_serve", fake_serve)

    main([])

    assert called is True
