from __future__ import annotations

# pyright: reportPrivateUsage=false
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


def test_serve_does_not_accept_token_option() -> None:
    with pytest.raises(SystemExit) as exit_info:
        cli.build_parser().parse_args(["serve", "--token", "obsolete"])

    assert exit_info.value.code == 2


def test_serve_uses_stable_editor_by_default() -> None:
    args = cli.build_parser().parse_args(["serve"])

    assert args.editor_url == cli.DEFAULT_EDITOR_URL


def test_editor_url_uses_selected_base_and_port() -> None:
    url = cli.build_editor_url("http://127.0.0.1:3000/development/", 9066)

    assert url == "http://127.0.0.1:3000/development/#mpelb-port=9066"


def test_serve_rejects_non_http_editor_url() -> None:
    with pytest.raises(SystemExit) as exit_info:
        cli.build_parser().parse_args(["serve", "--editor-url", "file:///tmp/editor"])

    assert exit_info.value.code == 2


def test_repository_server_uses_localbridge_as_workspace() -> None:
    package_path = Path(__file__).parents[2] / "package.json"
    package = json.loads(package_path.read_text(encoding="utf-8"))

    assert "--root LocalBridge" in package["scripts"]["server"]


def test_uvicorn_access_logger_is_disabled() -> None:
    app, state = cli.create_app()
    try:
        config = cli._build_uvicorn_config(app, 9066)
    finally:
        state.events.close()

    assert config.access_log is False
