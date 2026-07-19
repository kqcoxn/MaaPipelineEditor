from __future__ import annotations

import logging
from collections.abc import Iterator
from pathlib import Path
from threading import Event
from typing import Any, cast
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from workspace_helpers import create_project

from mpe_localbridge.config import ConfigStore
from mpe_localbridge.constants import PACKAGE_VERSION, PROTOCOL_VERSION
from mpe_localbridge.server import LocalBridgeState, create_app

ORIGIN = "http://localhost:3000"


@pytest.fixture
def client(tmp_path: Path) -> Iterator[tuple[TestClient, LocalBridgeState]]:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    prepared = create_project(
        workspace,
        preferences_path=tmp_path / "prepared-preferences.json",
    )
    pipeline = prepared.root / "project" / "resource" / "pipeline" / "main.json"
    pipeline.write_text('{"Start": {}}', encoding="utf-8")
    config_store = ConfigStore(tmp_path / "config.json")
    config_store.update({"file": {"root": str(workspace)}})
    app, state = create_app(config_store=config_store, data_dir=tmp_path / "data")
    with TestClient(app) as test_client:
        yield test_client, state


def _request(request_id: str, method: str, params: dict[str, Any]) -> dict[str, Any]:
    return {"v": 2, "type": "request", "id": request_id, "method": method, "params": params}


def _receive_response(websocket: Any, request_id: str) -> dict[str, Any]:
    while True:
        message: dict[str, Any] = websocket.receive_json()
        if message.get("type") == "response" and message.get("id") == request_id:
            return message


def _receive_event(websocket: Any, event_name: str) -> dict[str, Any]:
    while True:
        message: dict[str, Any] = websocket.receive_json()
        if message.get("type") == "event" and message.get("event") == event_name:
            return message


def _hello(websocket: Any, **overrides: Any) -> dict[str, Any]:
    params: dict[str, Any] = {
        "protocolVersion": PROTOCOL_VERSION,
        "clientVersion": PACKAGE_VERSION,
        "clientKind": "test",
    }
    params.update(overrides)
    websocket.send_json(_request("hello", "system.hello", params))
    return _receive_response(websocket, "hello")


def test_websocket_rejects_unknown_origin(client: tuple[TestClient, LocalBridgeState]) -> None:
    test_client, _ = client
    with pytest.raises(WebSocketDisconnect) as caught:
        with test_client.websocket_connect(
            "/v2/ws", headers={"origin": "https://untrusted.example"}
        ):
            pass
    assert caught.value.code == 1008


def test_websocket_requires_hello_handshake(client: tuple[TestClient, LocalBridgeState]) -> None:
    test_client, _ = client
    with test_client.websocket_connect("/v2/ws", headers={"origin": ORIGIN}) as websocket:
        websocket.send_json(_request("health", "system.health", {}))
        response = _receive_response(websocket, "health")
        assert response["error"]["code"] == "handshake_required"


def test_hello_reports_versions_and_capabilities(
    client: tuple[TestClient, LocalBridgeState],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    test_client, state = client

    async def fail_probe() -> dict[str, Any]:
        raise AssertionError("system.hello must not wait for MaaFw probe")

    monkeypatch.setattr(state.maa, "probe", fail_probe)
    with test_client.websocket_connect("/v2/ws", headers={"origin": ORIGIN}) as websocket:
        response = _hello(websocket)
        assert response["result"]["protocolVersion"] == PROTOCOL_VERSION
        assert response["result"]["packageVersion"] == PACKAGE_VERSION
        assert "maa" not in response["result"]
        assert response["result"]["capabilities"]["binaryArtifacts"] is True
        assert response["result"]["capabilities"]["debug"]["pause"] is False


def test_hello_pushes_initial_workspace_tree(
    client: tuple[TestClient, LocalBridgeState],
) -> None:
    test_client, state = client
    with test_client.websocket_connect("/v2/ws", headers={"origin": ORIGIN}) as websocket:
        response = _hello(websocket)
        tree_event = _receive_event(websocket, "workspace.tree")

    assert response["result"]["success"] is True
    assert tree_event["data"]["root"] == str(state.workspace.root)
    assert tree_event["data"]["revision"] >= 1
    assert any(
        entry["path"] == "project/resource/pipeline/main.json"
        for entry in tree_event["data"]["entries"]
    )


def test_hello_responds_before_workspace_scan_without_blocking_rpc(
    client: tuple[TestClient, LocalBridgeState],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    test_client, state = client
    scan_started = Event()
    release_scan = Event()
    scan_timed_out = Event()

    original_index_file = state.workspace.index_file

    def slow_index_file(revision: int, relative_path: str) -> dict[str, Any] | None:
        scan_started.set()
        if not release_scan.wait(timeout=5):
            scan_timed_out.set()
        return original_index_file(revision, relative_path)

    monkeypatch.setattr(state.workspace, "index_file", slow_index_file)
    with test_client.websocket_connect("/v2/ws", headers={"origin": ORIGIN}) as websocket:
        hello = _hello(websocket)
        assert hello["result"]["success"] is True
        assert scan_started.wait(timeout=1)

        websocket.send_json(_request("health", "system.health", {}))
        health = _receive_response(websocket, "health")
        release_scan.set()

        assert health["result"]["status"] == "ok"
        assert not scan_timed_out.is_set()


def test_hello_rejects_protocol_and_desktop_version(
    client: tuple[TestClient, LocalBridgeState],
) -> None:
    test_client, _ = client
    with test_client.websocket_connect("/v2/ws", headers={"origin": ORIGIN}) as websocket:
        protocol_response = _hello(websocket, protocolVersion="1.0.0")
        assert protocol_response["error"]["code"] == "protocol_mismatch"

        desktop_response = _hello(
            websocket,
            clientKind="desktop",
            clientVersion="0.0.0",
        )
        assert desktop_response["error"]["code"] == "version_mismatch"


def test_artifact_upload_and_download_require_allowed_origin(
    client: tuple[TestClient, LocalBridgeState],
) -> None:
    test_client, _ = client
    http_client = cast(httpx.Client, test_client)
    files = {"file": ("sample.txt", b"artifact-body", "text/plain")}

    assert http_client.post("/v2/artifacts", files=files).status_code == 403
    assert (
        http_client.post(
            "/v2/artifacts",
            files=files,
            headers={"origin": "https://untrusted.example"},
        ).status_code
        == 403
    )

    response = http_client.post(
        "/v2/artifacts",
        files=files,
        headers={"origin": ORIGIN},
    )
    assert response.status_code == 200
    artifact = cast(dict[str, Any], response.json())
    assert artifact["mimeType"] == "text/plain"
    assert artifact["size"] == len(b"artifact-body")

    download = http_client.get(
        f"/v2/artifacts/{artifact['artifactId']}",
        headers={"origin": ORIGIN},
    )
    assert download.status_code == 200
    assert download.content == b"artifact-body"


def test_http_access_is_logged_at_debug(
    client: tuple[TestClient, LocalBridgeState],
    caplog: pytest.LogCaptureFixture,
) -> None:
    test_client, _ = client
    http_client = cast(httpx.Client, test_client)
    caplog.set_level(logging.DEBUG, logger="mpe_localbridge.server")

    response = http_client.get(
        "/v2/artifacts/missing",
        headers={"origin": ORIGIN},
    )

    assert response.status_code == 404
    access_records = [record for record in caplog.records if record.message.startswith("HTTP ")]
    assert len(access_records) == 1
    assert access_records[0].levelno == logging.DEBUG


@pytest.mark.asyncio
async def test_workspace_change_refreshes_tree_for_mixed_structural_events(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    workspace_root = tmp_path / "workspace"
    workspace_root.mkdir()
    create_project(
        workspace_root,
        preferences_path=tmp_path / "prepared-preferences.json",
    )
    config_store = ConfigStore(tmp_path / "config.json")
    config_store.update({"file": {"root": str(workspace_root)}})
    state = LocalBridgeState(config_store, tmp_path / "data")
    refresh_files = AsyncMock()
    refresh_tree = AsyncMock()
    emit = AsyncMock()

    def tracks_files(_: list[str]) -> bool:
        return True

    monkeypatch.setattr(state, "refresh_modified_files", refresh_files)
    monkeypatch.setattr(state, "refresh_tree", refresh_tree)
    monkeypatch.setattr(state.hub, "emit", emit)
    monkeypatch.setattr(state.workspace, "tracks_files", tracks_files)
    pipeline_event = {
        "type": "modified",
        "file_path": "project/resource/pipeline/main.json",
        "is_directory": False,
    }
    project_event = {
        "type": "created",
        "file_path": "project/readme.md",
        "is_directory": False,
    }

    try:
        await state.workspace_changed(
            [pipeline_event, project_event],
            False,
            [pipeline_event],
        )
    finally:
        await state.close()

    refresh_files.assert_awaited_once_with(
        ["project/resource/pipeline/main.json"]
    )
    refresh_tree.assert_awaited_once_with()
    assert emit.await_count == 2
