from __future__ import annotations

import logging
from collections.abc import Iterator
from pathlib import Path
from threading import Event
from typing import Any, cast
from unittest.mock import AsyncMock, Mock

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
    pipeline = prepared.root / "resource" / "pipeline" / "main.json"
    pipeline.write_text('{"Start": {}}', encoding="utf-8")
    (prepared.root / "notes.jsonc").write_text(
        "// note\n{\"value\": 1}\n",
        encoding="utf-8",
    )
    (prepared.root / "preview.png").write_bytes(b"\x89PNG\r\n\x1a\n")
    (prepared.root / "archive.bin").write_bytes(b"\x00\x01")
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


def test_hello_pushes_initial_project_entries(
    client: tuple[TestClient, LocalBridgeState],
) -> None:
    test_client, state = client
    with test_client.websocket_connect("/v2/ws", headers={"origin": ORIGIN}) as websocket:
        response = _hello(websocket)
        entries_event = _receive_event(websocket, "project.entries")

    assert response["result"]["success"] is True
    assert entries_event["data"]["projectId"] == state.workspace.status()["project_id"]
    assert entries_event["data"]["revision"] >= 1
    assert any(
        entry["path"] == "resource/pipeline/main.json"
        for entry in entries_event["data"]["entries"]
    )


def test_hello_project_entries_include_document_metadata(
    client: tuple[TestClient, LocalBridgeState],
) -> None:
    test_client, _state = client
    with test_client.websocket_connect("/v2/ws", headers={"origin": ORIGIN}) as websocket:
        response = _hello(websocket)
        entries_event = _receive_event(websocket, "project.entries")

    assert response["result"]["success"] is True
    entries = {
        entry["path"]: entry for entry in entries_event["data"]["entries"]
    }
    assert entries["resource/pipeline/main.json"]["kind"] == "pipeline"
    assert entries["notes.jsonc"]["mimeType"] == "application/json"
    assert entries["notes.jsonc"]["documentId"].startswith("document:")


def test_document_rpc_opens_text_image_and_binary(
    client: tuple[TestClient, LocalBridgeState],
) -> None:
    test_client, state = client
    with test_client.websocket_connect("/v2/ws", headers={"origin": ORIGIN}) as websocket:
        _hello(websocket)
        websocket.send_json(
            _request("text", "document.open", {"path": "notes.jsonc"})
        )
        text_response = _receive_response(websocket, "text")
        websocket.send_json(
            _request("image", "document.open", {"path": "preview.png"})
        )
        image_response = _receive_response(websocket, "image")
        websocket.send_json(
            _request("binary", "document.open", {"path": "archive.bin"})
        )
        binary_response = _receive_response(websocket, "binary")

    expected = (state.workspace.root / "notes.jsonc").read_bytes().decode()
    assert text_response["result"]["content"] == expected
    assert text_response["result"]["encoding"] == "utf-8"
    assert text_response["result"]["mimeType"] == "application/json"
    assert image_response["result"]["artifact"]["kind"] == "project-image"
    assert image_response["result"]["artifact"]["mimeType"] == "image/png"
    assert binary_response["result"]["kind"] == "binary"
    assert "content" not in binary_response["result"]
    assert "_path" not in binary_response["result"]


def test_file_management_rpcs_rename_and_delete(
    client: tuple[TestClient, LocalBridgeState],
) -> None:
    test_client, state = client
    source = state.workspace.root / "managed.txt"
    source.write_text("managed", encoding="utf-8")
    state.workspace.refresh_tree()
    state.workspace.refresh_documents()

    with test_client.websocket_connect("/v2/ws", headers={"origin": ORIGIN}) as websocket:
        _hello(websocket)
        websocket.send_json(
            _request(
                "rename",
                "entry.rename",
                {"path": "managed.txt", "name": "renamed.txt"},
            )
        )
        rename_response = None
        rename_event = None
        while rename_response is None or rename_event is None:
            message = websocket.receive_json()
            if message.get("type") == "response" and message.get("id") == "rename":
                rename_response = message
            if (
                message.get("type") == "event"
                and message.get("event") == "project.changed"
                and message.get("data", {}).get("change") == "renamed"
            ):
                rename_event = message["data"]
        websocket.send_json(
            _request("delete", "entry.delete", {"path": "renamed.txt"})
        )
        delete_response = _receive_response(websocket, "delete")

    renamed = state.workspace.root / "renamed.txt"
    assert rename_response["result"]["oldPath"] == "managed.txt"
    assert rename_response["result"]["newPath"] == "renamed.txt"
    assert rename_response["result"]["isDirectory"] is False
    assert rename_response["result"]["documentMappings"][0]["oldPath"] == "managed.txt"
    assert rename_response["result"]["documentMappings"][0]["newPath"] == "renamed.txt"
    assert isinstance(rename_response["result"]["operationId"], str)
    assert rename_response["result"]["operationId"]
    assert rename_event["path"] == "managed.txt"
    assert rename_event["newPath"] == "renamed.txt"
    assert rename_event["isDirectory"] is False
    assert rename_event["operationId"] == rename_response["result"]["operationId"]
    assert delete_response["result"]["path"] == "renamed.txt"
    assert not source.exists()
    assert not renamed.exists()


def test_directory_rename_event_reports_old_and_new_paths(
    client: tuple[TestClient, LocalBridgeState],
) -> None:
    test_client, state = client
    source = state.workspace.root / "nested"
    source.mkdir()
    (source / "notes.txt").write_text("notes", encoding="utf-8")
    state.workspace.refresh_tree()
    state.workspace.refresh_documents()

    with test_client.websocket_connect("/v2/ws", headers={"origin": ORIGIN}) as websocket:
        _hello(websocket)
        websocket.send_json(
            _request(
                "rename-directory",
                "entry.rename",
                {"path": "nested", "name": "renamed"},
            )
        )
        rename_response = None
        rename_event = None
        while rename_response is None or rename_event is None:
            message = websocket.receive_json()
            if (
                message.get("type") == "response"
                and message.get("id") == "rename-directory"
            ):
                rename_response = message
            if (
                message.get("type") == "event"
                and message.get("event") == "project.changed"
                and message.get("data", {}).get("change") == "renamed"
            ):
                rename_event = message["data"]

    assert rename_response["result"]["oldPath"] == "nested"
    assert rename_response["result"]["newPath"] == "renamed"
    assert rename_response["result"]["isDirectory"] is True
    mappings = rename_response["result"]["documentMappings"]
    assert [(item["oldPath"], item["newPath"]) for item in mappings] == [
        ("nested/notes.txt", "renamed/notes.txt")
    ]
    assert rename_event["path"] == "nested"
    assert rename_event["newPath"] == "renamed"
    assert rename_event["isDirectory"] is True
    assert rename_event["documentMappings"] == mappings
    assert rename_event["operationId"] == rename_response["result"]["operationId"]
    assert not source.exists()
    assert (state.workspace.root / "renamed" / "notes.txt").exists()


def test_document_rpc_saves_with_revision_and_reports_conflict(
    client: tuple[TestClient, LocalBridgeState],
) -> None:
    test_client, state = client
    path = "notes.jsonc"
    with test_client.websocket_connect("/v2/ws", headers={"origin": ORIGIN}) as websocket:
        _hello(websocket)
        websocket.send_json(_request("open", "document.open", {"path": path}))
        opened = _receive_response(websocket, "open")["result"]
        changed = "// retained\n{\"second\": 2, \"first\": 1}\r\n"
        websocket.send_json(
            _request(
                "save",
                "document.save",
                {
                    "path": path,
                    "content": changed,
                    "base_revision": opened["revision"],
                },
            )
        )
        saved = _receive_response(websocket, "save")

        (state.workspace.root / path).write_text("external\n", encoding="utf-8")
        websocket.send_json(
            _request(
                "conflict",
                "document.save",
                {
                    "path": path,
                    "content": "local\n",
                    "base_revision": saved["result"]["revision"],
                },
            )
        )
        conflict = _receive_response(websocket, "conflict")

    assert (state.workspace.root / path).read_text(encoding="utf-8") == "external\n"
    assert conflict["error"]["code"] == "document_conflict"
    assert conflict["error"]["data"]["path"] == path


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
    state.workspace.discover()
    state.workspace.refresh_files()
    state.workspace.refresh_tree()
    state.workspace.refresh_documents()
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
        "file_path": "resource/pipeline/main.json",
        "is_directory": False,
    }
    project_event = {
        "type": "created",
        "file_path": "readme.md",
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
        ["resource/pipeline/main.json"]
    )
    refresh_tree.assert_awaited_once_with()
    assert emit.await_count == 2


@pytest.mark.asyncio
async def test_workspace_change_refreshes_documents_for_ordinary_modification(
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
    state.workspace.discover()
    state.workspace.refresh_files()
    state.workspace.refresh_tree()
    state.workspace.refresh_documents()
    refresh_documents = Mock(
        return_value={"revision": 2, "root": str(workspace_root), "documents": []}
    )
    emit = AsyncMock()
    monkeypatch.setattr(state.workspace, "refresh_documents", refresh_documents)
    monkeypatch.setattr(state.hub, "emit", emit)
    event = {
        "type": "modified",
        "file_path": "readme.md",
        "is_directory": False,
    }

    try:
        await state.workspace_changed([event], False, [])
    finally:
        await state.close()

    refresh_documents.assert_called_once_with()
    assert emit.await_args_list[0].args[0] == "project.changed"
    assert emit.await_args_list[0].args[1]["path"] == "readme.md"
    assert isinstance(emit.await_args_list[0].args[1]["operationId"], str)
    assert emit.await_args_list[0].args[1]["operationId"]
    assert emit.await_args_list[1].args[0] == "project.entries"
