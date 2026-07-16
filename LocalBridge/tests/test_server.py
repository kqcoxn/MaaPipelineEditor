from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from threading import Event
from typing import Any, cast

import httpx
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from mpe_localbridge.config import ConfigStore
from mpe_localbridge.constants import PACKAGE_VERSION, PROTOCOL_VERSION
from mpe_localbridge.server import LocalBridgeState, create_app

ORIGIN = "http://localhost:3000"


@pytest.fixture
def client(tmp_path: Path) -> Iterator[tuple[TestClient, LocalBridgeState]]:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
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


def test_hello_responds_before_workspace_scan_without_blocking_rpc(
    client: tuple[TestClient, LocalBridgeState],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    test_client, state = client
    scan_started = Event()
    release_scan = Event()
    scan_timed_out = Event()

    def slow_snapshot() -> dict[str, Any]:
        scan_started.set()
        if not release_scan.wait(timeout=5):
            scan_timed_out.set()
        return {"root": str(state.workspace.root), "files": [], "directories": []}

    monkeypatch.setattr(state.workspace, "snapshot", slow_snapshot)
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
