from __future__ import annotations

import asyncio
import hashlib
import logging
import sys
import time
from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

import httpx
from fastapi import FastAPI, HTTPException, Request, UploadFile, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import ValidationError
from starlette.websockets import WebSocketDisconnect, WebSocketState

from .artifacts import ArtifactStore
from .config import ConfigStore
from .constants import (
    MAX_ARTIFACT_BYTES,
    MAX_CONNECTION_REQUESTS,
    PACKAGE_VERSION,
    PROTOCOL_VERSION,
    RPC_METHOD_NAMES,
)
from .debug_runtime import DebugManager
from .errors import InvalidArgumentError, LocalBridgeError
from .event_log import EventLog
from .maa_runtime import MaaRuntimeService
from .models import HelloParams, RpcError, RpcEvent, RpcRequest, RpcResponse
from .watcher import WorkspaceWatcher
from .workspace import Workspace

Handler = Callable[["RpcContext", dict[str, Any]], Awaitable[Any]]
AfterResponse = Callable[[], Awaitable[None]]
LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class HandlerResult:
    value: Any
    after_response: AfterResponse | None = None


class ConnectionHub:
    def __init__(self) -> None:
        self._connections: set[RpcContext] = set()
        self._lock = asyncio.Lock()

    async def add(self, connection: RpcContext) -> None:
        async with self._lock:
            self._connections.add(connection)

    async def remove(self, connection: RpcContext) -> None:
        async with self._lock:
            self._connections.discard(connection)

    async def emit(self, event: str, data: dict[str, Any]) -> None:
        async with self._lock:
            connections = tuple(self._connections)
        if not connections:
            return
        await asyncio.gather(
            *(
                connection.emit(event, data)
                for connection in connections
                if connection.handshake_completed
            ),
            return_exceptions=True,
        )


class LocalBridgeState:
    def __init__(
        self,
        config_store: ConfigStore,
        data_dir: Path | None = None,
    ) -> None:
        self.config_store = config_store
        self.artifacts = ArtifactStore(data_dir / "artifacts" if data_dir else None)
        self.events = EventLog(data_dir / "debug-events.sqlite3" if data_dir else None)
        self.workspace = Workspace(config_store.value.file)
        self.hub = ConnectionHub()
        self.maa = MaaRuntimeService(
            config_store.value.maafw,
            self.artifacts,
            Path(config_store.value.log.dir),
        )
        self.debug = DebugManager(self.maa, self.events, self.artifacts, self.hub.emit)
        self.watcher = WorkspaceWatcher(self.workspace, self.hub.emit)
        self.http = httpx.AsyncClient(timeout=httpx.Timeout(120, connect=15))
        self._closed = False

    async def start(self) -> None:
        await self.watcher.start()

    async def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        await self.watcher.close()
        await self.debug.close()
        await self.maa.close()
        await self.http.aclose()
        self.events.close()


class RpcContext:
    def __init__(self, websocket: WebSocket, state: LocalBridgeState) -> None:
        self.websocket = websocket
        self.state = state
        self.handshake_completed = False
        self.client_kind = "web"
        self.client_version = ""
        self._send_lock = asyncio.Lock()
        self.request_slots = asyncio.Semaphore(MAX_CONNECTION_REQUESTS)
        self.tasks: dict[str, asyncio.Task[None]] = {}

    async def send_response(self, response: RpcResponse) -> None:
        if self.websocket.client_state != WebSocketState.CONNECTED:
            return
        async with self._send_lock:
            await self.websocket.send_text(
                response.model_dump_json(by_alias=True, exclude_none=True)
            )

    async def complete_handshake(self, response: RpcResponse) -> bool:
        if self.websocket.client_state != WebSocketState.CONNECTED:
            return False
        async with self._send_lock:
            self.handshake_completed = True
            await self.websocket.send_text(
                response.model_dump_json(by_alias=True, exclude_none=True)
            )
        return True

    async def emit(self, event: str, data: dict[str, Any]) -> None:
        if self.websocket.client_state != WebSocketState.CONNECTED:
            return
        message = RpcEvent(event=event, data=data)
        async with self._send_lock:
            await self.websocket.send_text(
                message.model_dump_json(by_alias=True, exclude_none=True)
            )

    def cancel(self, request_id: str) -> bool:
        task = self.tasks.get(request_id)
        if task is None:
            return False
        task.cancel()
        return True

    async def close(self) -> None:
        for task in self.tasks.values():
            task.cancel()
        if self.tasks:
            await asyncio.gather(*self.tasks.values(), return_exceptions=True)

    def register(self, request_id: str, task: asyncio.Task[None]) -> bool:
        if request_id in self.tasks:
            return False
        self.tasks[request_id] = task
        return True

    def finish(self, request_id: str) -> None:
        self.tasks.pop(request_id, None)


class Dispatcher:
    def __init__(self, state: LocalBridgeState) -> None:
        self.state = state
        self.handlers: dict[str, Handler] = {
            "system.hello": self._hello,
            "system.health": self._health,
            "system.cancel": self._cancel,
            "config.get": self._config_get,
            "config.update": self._config_update,
            "config.reload": self._config_reload,
            "workspace.scan": self._workspace_scan,
            "file.open": self._file_open,
            "file.create": self._file_create,
            "file.save": self._file_save,
            "file.saveSeparated": self._file_save_separated,
            "resource.list": self._resource_list,
            "resource.refresh": self._resource_list,
            "resource.image.list": self._resource_image_list,
            "resource.image.get": self._resource_image_get,
            "resource.image.getMany": self._resource_image_get_many,
            "maa.device.listAdb": self._maa_adb,
            "maa.window.listDesktop": self._maa_windows,
            "maa.window.listWlroots": self._maa_wlroots,
            "maa.controller.create": self._maa_controller_create,
            "maa.controller.disconnect": self._maa_controller_disconnect,
            "maa.controller.screencap": self._maa_screencap,
            "maa.controller.command": self._maa_command,
            "maa.action.execute": self._maa_action_execute,
            "tool.ocr": self._tool_ocr,
            "tool.templateMatch": self._tool_template_match,
            "tool.image.resolve": self._tool_image_resolve,
            "tool.log.read": self._tool_log_read,
            "tool.log.locate": self._tool_log_locate,
            "ai.complete": self._ai_complete,
            "ai.stream.start": self._ai_stream,
            "ai.stream.cancel": self._ai_stream_cancel,
            "debug.capabilities": self._debug_capabilities,
            "debug.session.create": self._debug_session_create,
            "debug.session.destroy": self._debug_session_destroy,
            "debug.session.snapshot": self._debug_session_snapshot,
            "debug.run.start": self._debug_run_start,
            "debug.run.stop": self._debug_run_stop,
            "debug.events.list": self._debug_events_list,
            "debug.resource.preflight": self._debug_resource_preflight,
            "debug.resource.health": self._debug_resource_health,
            "debug.agent.test": self._debug_agent_test,
            "debug.screenshot.capture": self._debug_screenshot,
        }
        if set(self.handlers) != set(RPC_METHOD_NAMES):
            raise RuntimeError("RPC 方法实现与协议清单不一致")

    async def dispatch(self, context: RpcContext, request: RpcRequest) -> None:
        if not context.handshake_completed and request.method != "system.hello":
            await context.send_response(
                RpcResponse(
                    id=request.id,
                    error=RpcError(code="handshake_required", message="必须先调用 system.hello"),
                )
            )
            await context.websocket.close(code=1008, reason="handshake required")
            return
        handler = self.handlers.get(request.method)
        if handler is None:
            await context.send_response(
                RpcResponse(
                    id=request.id,
                    error=RpcError(code="method_not_found", message=f"未知方法: {request.method}"),
                )
            )
            return

        async def execute() -> None:
            async with context.request_slots:
                after_response: AfterResponse | None = None
                try:
                    handled = await handler(context, request.params)
                    if isinstance(handled, HandlerResult):
                        result = handled.value
                        after_response = handled.after_response
                    else:
                        result = handled
                    response = RpcResponse(id=request.id, result=result)
                    if request.method == "system.hello":
                        if not await context.complete_handshake(response):
                            after_response = None
                    else:
                        await context.send_response(response)
                except asyncio.CancelledError:
                    await context.send_response(
                        RpcResponse(
                            id=request.id,
                            error=RpcError(code="cancelled", message="请求已取消"),
                        )
                    )
                except LocalBridgeError as error:
                    await context.send_response(
                        RpcResponse(
                            id=request.id,
                            error=RpcError(code=error.code, message=error.message, data=error.data),
                        )
                    )
                except (KeyError, TypeError, ValueError) as error:
                    await context.send_response(
                        RpcResponse(
                            id=request.id,
                            error=RpcError(code="invalid_argument", message=str(error)),
                        )
                    )
                except Exception as error:
                    LOGGER.exception("RPC %s failed", request.method)
                    await context.send_response(
                        RpcResponse(
                            id=request.id,
                            error=RpcError(code="internal", message=str(error)),
                        )
                    )
                else:
                    if after_response is not None:
                        try:
                            await after_response()
                        except asyncio.CancelledError:
                            raise
                        except Exception:
                            LOGGER.exception("RPC %s post-response task failed", request.method)
                finally:
                    context.finish(request.id)

        task = asyncio.create_task(execute(), name=f"rpc-{request.method}-{request.id}")
        if not context.register(request.id, task):
            task.cancel()
            await context.send_response(
                RpcResponse(
                    id=request.id,
                    error=RpcError(code="duplicate_request_id", message="请求 id 正在使用"),
                )
            )

    async def _hello(self, context: RpcContext, params: dict[str, Any]) -> HandlerResult:
        hello = HelloParams.model_validate(params)
        if hello.protocol_version != PROTOCOL_VERSION:
            raise LocalBridgeError(
                "protocol_mismatch",
                f"协议版本不匹配: client={hello.protocol_version}, server={PROTOCOL_VERSION}",
                data={"requiredVersion": PROTOCOL_VERSION},
            )
        if hello.client_kind == "desktop" and hello.client_version != PACKAGE_VERSION:
            raise LocalBridgeError(
                "version_mismatch",
                f"Desktop 与 LocalBridge 版本必须一致: {hello.client_version} != {PACKAGE_VERSION}",
            )
        context.client_kind = hello.client_kind
        context.client_version = hello.client_version
        return HandlerResult(
            value={
                "success": True,
                "protocolVersion": PROTOCOL_VERSION,
                "packageVersion": PACKAGE_VERSION,
                "pythonVersion": sys.version.split()[0],
                "capabilities": {
                    "rpcCancellation": True,
                    "eventResume": True,
                    "binaryArtifacts": True,
                    "debug": self.state.debug.capabilities(),
                },
            },
            after_response=lambda: self._push_initial_state(context, hello.after_seq),
        )

    async def _push_initial_state(self, context: RpcContext, cursors: dict[str, int]) -> None:
        snapshot = await asyncio.to_thread(self.state.workspace.snapshot)
        await context.emit("workspace.files", snapshot)
        bundles = await asyncio.to_thread(self.state.workspace.resource_bundles)
        await context.emit("resource.bundles", bundles)
        for session_id, after_seq in cursors.items():
            events = self.state.events.list(session_id, after_seq=after_seq)
            for event in events:
                await context.emit("debug.event", event.model_dump(mode="json", by_alias=True))

    async def _health(self, context: RpcContext, params: dict[str, Any]) -> dict[str, Any]:
        del context, params
        return {
            "status": "ok",
            "protocolVersion": PROTOCOL_VERSION,
            "packageVersion": PACKAGE_VERSION,
        }

    async def _cancel(self, context: RpcContext, params: dict[str, Any]) -> dict[str, Any]:
        return {"cancelled": context.cancel(str(params.get("requestId", "")))}

    async def _config_get(self, context: RpcContext, params: dict[str, Any]) -> dict[str, Any]:
        del params
        result = self._config_response()
        await context.emit("config.data", result)
        return result

    async def _config_update(self, context: RpcContext, params: dict[str, Any]) -> dict[str, Any]:
        config = self.state.config_store.update(params)
        self.state.workspace.reconfigure(config.file)
        await self.state.watcher.restart()
        result = self._config_response("配置已保存")
        await context.emit("config.data", result)
        await self.state.hub.emit("workspace.files", self.state.workspace.snapshot())
        return result

    async def _config_reload(self, context: RpcContext, params: dict[str, Any]) -> dict[str, Any]:
        del params
        config = self.state.config_store.reload()
        self.state.workspace.reconfigure(config.file)
        await self.state.watcher.restart()
        result = {"success": True, "config": config.model_dump(mode="json")}
        await context.emit("config.reloaded", result)
        await self.state.hub.emit("workspace.files", self.state.workspace.snapshot())
        return result

    def _config_response(self, message: str | None = None) -> dict[str, Any]:
        config = self.state.config_store.value.model_dump(mode="json")
        return {
            "success": True,
            "config": config,
            "config_path": str(self.state.config_store.path),
            "message": message,
        }

    async def _workspace_scan(self, context: RpcContext, params: dict[str, Any]) -> dict[str, Any]:
        del params
        result = await asyncio.to_thread(self.state.workspace.snapshot)
        await context.emit("workspace.files", result)
        return result

    async def _file_open(self, context: RpcContext, params: dict[str, Any]) -> dict[str, Any]:
        result = await asyncio.to_thread(self.state.workspace.open_file, str(params["file_path"]))
        await context.emit("file.content", result)
        return result

    async def _file_create(self, context: RpcContext, params: dict[str, Any]) -> dict[str, Any]:
        result = await asyncio.to_thread(
            self.state.workspace.create_file,
            str(params["file_name"]),
            str(params.get("directory", "")),
            params.get("content"),
        )
        await context.emit("file.created", result)
        await self.state.hub.emit("workspace.files", self.state.workspace.snapshot())
        return result

    async def _file_save(self, context: RpcContext, params: dict[str, Any]) -> dict[str, Any]:
        result = await asyncio.to_thread(
            self.state.workspace.save_file,
            str(params["file_path"]),
            params.get("content"),
            params.get("content_json"),
            int(params.get("indent", 0)),
        )
        await context.emit("file.saved", result)
        await self.state.hub.emit(
            "file.changed",
            {"type": "modified", "file_path": result["file_path"], "is_directory": False},
        )
        return result

    async def _file_save_separated(
        self, context: RpcContext, params: dict[str, Any]
    ) -> dict[str, Any]:
        result = await asyncio.to_thread(self.state.workspace.save_separated, params)
        await context.emit("file.separatedSaved", result)
        return result

    async def _resource_list(self, context: RpcContext, params: dict[str, Any]) -> dict[str, Any]:
        del params
        result = await asyncio.to_thread(self.state.workspace.resource_bundles)
        await context.emit("resource.bundles", result)
        return result

    async def _resource_image_list(
        self, context: RpcContext, params: dict[str, Any]
    ) -> dict[str, Any]:
        result = await asyncio.to_thread(
            self.state.workspace.image_list, str(params.get("pipeline_path", ""))
        )
        await context.emit("resource.imageList", result)
        return result

    async def _resource_image_get(
        self, context: RpcContext, params: dict[str, Any]
    ) -> dict[str, Any]:
        relative_path = str(params["relative_path"])
        path, bundle_name = await asyncio.to_thread(self.state.workspace.find_image, relative_path)
        ref = await asyncio.to_thread(self.state.artifacts.add_path, path, kind="resource-image")
        result = {
            "success": True,
            "relative_path": relative_path,
            "bundle_name": bundle_name,
            "artifact": ref.model_dump(mode="json", by_alias=True),
        }
        await context.emit("resource.image", result)
        return result

    async def _resource_image_get_many(
        self, context: RpcContext, params: dict[str, Any]
    ) -> dict[str, Any]:
        images: list[dict[str, Any]] = []
        for value in params.get("relative_paths", []):
            relative_path = str(value)
            try:
                path, bundle_name = await asyncio.to_thread(
                    self.state.workspace.find_image, relative_path
                )
                ref = await asyncio.to_thread(
                    self.state.artifacts.add_path, path, kind="resource-image"
                )
                images.append(
                    {
                        "success": True,
                        "relative_path": relative_path,
                        "bundle_name": bundle_name,
                        "artifact": ref.model_dump(mode="json", by_alias=True),
                    }
                )
            except LocalBridgeError as error:
                images.append(
                    {
                        "success": False,
                        "relative_path": relative_path,
                        "message": error.message,
                    }
                )
        result = {"images": images}
        await context.emit("resource.images", result)
        return result

    async def _maa_adb(self, context: RpcContext, params: dict[str, Any]) -> dict[str, Any]:
        devices = await self.state.maa.list_adb_devices(params.get("adb_path"))
        result = {"devices": devices}
        await context.emit("maa.adbDevices", result)
        return result

    async def _maa_windows(self, context: RpcContext, params: dict[str, Any]) -> dict[str, Any]:
        del params
        windows = await self.state.maa.list_desktop_windows()
        result = {"windows": windows}
        await context.emit("maa.desktopWindows", result)
        return result

    async def _maa_wlroots(self, context: RpcContext, params: dict[str, Any]) -> dict[str, Any]:
        del params
        compositors = await self.state.maa.list_wlroots_compositors()
        result = {"compositors": compositors}
        await context.emit("maa.wlrootsSockets", result)
        return result

    async def _maa_controller_create(
        self, context: RpcContext, params: dict[str, Any]
    ) -> dict[str, Any]:
        result = await self.state.maa.create_controller(
            str(params["controller_type"]), dict(params.get("options") or params)
        )
        await context.emit("maa.controllerCreated", result)
        return result

    async def _maa_controller_disconnect(
        self, context: RpcContext, params: dict[str, Any]
    ) -> dict[str, Any]:
        result = await self.state.maa.disconnect_controller(str(params["controller_id"]))
        await context.emit("maa.controllerStatus", result)
        return result

    async def _maa_screencap(self, context: RpcContext, params: dict[str, Any]) -> dict[str, Any]:
        result = await self.state.maa.screencap(str(params["controller_id"]))
        await context.emit("maa.screencap", result)
        return result

    async def _maa_command(self, context: RpcContext, params: dict[str, Any]) -> dict[str, Any]:
        result = await self.state.maa.controller_command(
            str(params["controller_id"]), str(params["command"]), dict(params.get("params", {}))
        )
        await context.emit("maa.commandResult", result)
        return result

    async def _maa_action_execute(
        self, context: RpcContext, params: dict[str, Any]
    ) -> dict[str, Any]:
        override = params.get("pipeline_override")
        if override is not None and not isinstance(override, dict):
            raise InvalidArgumentError("pipeline_override 必须是对象")
        pipeline_override = (
            {str(key): value for key, value in cast(dict[Any, Any], override).items()}
            if isinstance(override, dict)
            else None
        )
        result = await self.state.maa.execute_action(
            str(params["controller_id"]),
            str(params["resource_path"]),
            str(params["entry"]),
            pipeline_override,
        )
        await context.emit("maa.actionExecuted", result)
        return result

    async def _tool_ocr(self, context: RpcContext, params: dict[str, Any]) -> dict[str, Any]:
        result = await self.state.maa.recognize_tool(
            "ocr", str(params["baseArtifactId"]), params
        )
        await context.emit("tool.ocrResult", result)
        return result

    async def _tool_template_match(
        self, context: RpcContext, params: dict[str, Any]
    ) -> dict[str, Any]:
        result = await self.state.maa.recognize_tool(
            "template-match", str(params["baseArtifactId"]), params
        )
        await context.emit("tool.templateMatchResult", result)
        return result

    async def _tool_image_resolve(
        self, context: RpcContext, params: dict[str, Any]
    ) -> dict[str, Any]:
        result = await asyncio.to_thread(
            self.state.workspace.resolve_image_name, str(params.get("file_name", ""))
        )
        await context.emit("tool.imageResolved", result)
        return result

    async def _tool_log_read(
        self, context: RpcContext, params: dict[str, Any]
    ) -> dict[str, Any]:
        del params
        result = await self.state.maa.read_log_tail()
        await context.emit("tool.logContent", result)
        return result

    async def _tool_log_locate(
        self, context: RpcContext, params: dict[str, Any]
    ) -> dict[str, Any]:
        del params
        result = await self.state.maa.locate_log()
        await context.emit("tool.logLocated", result)
        return result

    async def _ai_complete(self, context: RpcContext, params: dict[str, Any]) -> dict[str, Any]:
        request_id = str(params.get("request_id", ""))
        method = str(params.get("method", "POST"))
        url = str(params["url"])
        headers = dict(params.get("headers", {}))
        body = params.get("body")
        if isinstance(body, str):
            response = await self.state.http.request(method, url, headers=headers, content=body)
        else:
            response = await self.state.http.request(method, url, headers=headers, json=body)
        try:
            response_body: Any = response.json()
        except ValueError:
            response_body = response.text
        if response.is_error:
            raise LocalBridgeError(
                "ai_upstream_error",
                f"AI 上游返回 HTTP {response.status_code}",
                data={"status": response.status_code, "body": response_body},
            )
        result = {
            "request_id": request_id,
            "status": response.status_code,
            "headers": dict(response.headers),
            "body": response_body,
        }
        await context.emit("ai.response", result)
        return result

    async def _ai_stream(self, context: RpcContext, params: dict[str, Any]) -> dict[str, Any]:
        request_id = str(params["request_id"])
        method = str(params.get("method", "POST"))
        url = str(params["url"])
        headers = dict(params.get("headers", {}))
        body = params.get("body")
        if isinstance(body, str):
            stream = self.state.http.stream(method, url, headers=headers, content=body)
        else:
            stream = self.state.http.stream(method, url, headers=headers, json=body)
        async with stream as response:
            if response.is_error:
                content = (await response.aread()).decode(errors="replace")
                raise LocalBridgeError(
                    "ai_upstream_error",
                    f"AI 上游返回 HTTP {response.status_code}",
                    data={"status": response.status_code, "body": content},
                )
            async for chunk in response.aiter_text():
                await context.emit(
                    "ai.streamChunk",
                    {"request_id": request_id, "chunk": chunk, "done": False},
                )
        result = {"request_id": request_id, "done": True}
        await context.emit("ai.streamChunk", result)
        return result

    async def _ai_stream_cancel(
        self, context: RpcContext, params: dict[str, Any]
    ) -> dict[str, Any]:
        return await self._cancel(context, {"requestId": params.get("request_id", "")})

    async def _debug_capabilities(
        self, context: RpcContext, params: dict[str, Any]
    ) -> dict[str, Any]:
        del params
        result = self.state.debug.capabilities()
        await context.emit("debug.capabilities", result)
        return result

    async def _debug_session_create(
        self, context: RpcContext, params: dict[str, Any]
    ) -> dict[str, Any]:
        del context
        return await self.state.debug.create(str(params.get("name", "Debug Session")))

    async def _debug_session_destroy(
        self, context: RpcContext, params: dict[str, Any]
    ) -> dict[str, Any]:
        del context
        return await self.state.debug.destroy(str(params["sessionId"]))

    async def _debug_session_snapshot(
        self, context: RpcContext, params: dict[str, Any]
    ) -> dict[str, Any]:
        result = self.state.debug.snapshot(str(params["sessionId"]))
        await context.emit("debug.sessionSnapshot", result)
        return result

    async def _debug_run_start(self, context: RpcContext, params: dict[str, Any]) -> dict[str, Any]:
        del context
        return await self.state.debug.start(params)

    async def _debug_run_stop(self, context: RpcContext, params: dict[str, Any]) -> dict[str, Any]:
        del context
        return await self.state.debug.stop(
            str(params["sessionId"]), params.get("runId"), str(params.get("reason", "user_stop"))
        )

    async def _debug_events_list(
        self, context: RpcContext, params: dict[str, Any]
    ) -> dict[str, Any]:
        del context
        return await self.state.debug.list_events(
            str(params["sessionId"]), int(params.get("afterSeq", 0)), int(params.get("limit", 2000))
        )

    async def _debug_resource_preflight(
        self, context: RpcContext, params: dict[str, Any]
    ) -> dict[str, Any]:
        result = await asyncio.to_thread(_check_resources, params)
        await context.emit("debug.resourcePreflight", result)
        return result

    async def _debug_resource_health(
        self, context: RpcContext, params: dict[str, Any]
    ) -> dict[str, Any]:
        result = await asyncio.to_thread(_check_resources, params)
        await context.emit("debug.resourceHealth", result)
        return result

    async def _debug_agent_test(
        self, context: RpcContext, params: dict[str, Any]
    ) -> dict[str, Any]:
        agent = dict(params.get("agent", {}))
        checked_at = datetime.now(UTC).isoformat()
        result: dict[str, Any]
        try:
            tested = await self.state.maa.test_agent(agent)
            result = {
                "agentId": tested["agentId"],
                "success": True,
                "checkedAt": checked_at,
                "message": "Agent 连接成功",
                "customRecognitions": tested.get("recognitions", []),
                "customActions": tested.get("actions", []),
            }
        except LocalBridgeError as error:
            result = {
                "agentId": str(agent.get("id", "agent")),
                "success": False,
                "checkedAt": checked_at,
                "message": error.message,
                "customRecognitions": list[str](),
                "customActions": list[str](),
            }
        await context.emit("debug.agentTested", result)
        return result

    async def _debug_screenshot(
        self, context: RpcContext, params: dict[str, Any]
    ) -> dict[str, Any]:
        controller_id = params.get("controllerId") or params.get("controller_id")
        if not controller_id:
            raise InvalidArgumentError("缺少 controllerId")
        result = await self.state.maa.screencap(str(controller_id))
        await context.emit("debug.artifact", result)
        return result


def _check_resources(params: dict[str, Any]) -> dict[str, Any]:
    started = time.perf_counter()
    paths = [Path(str(value)).expanduser().resolve() for value in params.get("resourcePaths", [])]
    diagnostics = [
        {
            "severity": "error",
            "code": "debug.resource.not_found",
            "message": f"资源路径不存在: {path}",
            "sourcePath": str(path),
        }
        for path in paths
        if not path.is_dir()
    ]
    fingerprint = hashlib.sha256()
    for path in paths:
        fingerprint.update(str(path).encode("utf-8"))
        if path.exists():
            stat = path.stat()
            fingerprint.update(f"{stat.st_mtime_ns}:{stat.st_size}".encode())
    return {
        "requestId": params.get("requestId"),
        "resourcePaths": [str(path) for path in paths],
        "status": "failed" if diagnostics else "ready",
        "hash": fingerprint.hexdigest(),
        "checkedAt": datetime.now(UTC).isoformat(),
        "durationMs": round((time.perf_counter() - started) * 1000, 3),
        "diagnostics": diagnostics,
    }


def create_app(
    *,
    config_store: ConfigStore | None = None,
    data_dir: Path | None = None,
) -> tuple[FastAPI, LocalBridgeState]:
    state = LocalBridgeState(config_store or ConfigStore(), data_dir)
    dispatcher = Dispatcher(state)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        await state.start()
        yield
        await state.close()

    app = FastAPI(
        title="MaaPipelineEditor LocalBridge",
        version=PACKAGE_VERSION,
        docs_url=None,
        lifespan=lifespan,
    )

    async def websocket_endpoint(websocket: WebSocket) -> None:
        origin = websocket.headers.get("origin")
        allowed = set(state.config_store.value.server.allowed_origins)
        if origin not in allowed:
            await websocket.close(code=1008, reason="origin not allowed")
            return
        await websocket.accept(subprotocol="mpe.v2")
        context = RpcContext(websocket, state)
        await state.hub.add(context)
        try:
            while True:
                raw = await websocket.receive_text()
                try:
                    request = RpcRequest.model_validate_json(raw)
                except ValidationError as error:
                    await context.send_response(
                        RpcResponse(
                            id="invalid",
                            error=RpcError(
                                code="invalid_request",
                                message="RPC 请求格式错误",
                                data={"errors": error.errors(include_url=False)},
                            ),
                        )
                    )
                    continue
                await dispatcher.dispatch(context, request)
                if websocket.application_state != WebSocketState.CONNECTED:
                    break
        except WebSocketDisconnect:
            pass
        finally:
            await state.hub.remove(context)
            await context.close()

    async def upload_artifact(
        request: Request,
        file: UploadFile,
    ) -> dict[str, Any]:
        _validate_http_origin(state, request)
        data = await file.read(MAX_ARTIFACT_BYTES + 1)
        if len(data) > MAX_ARTIFACT_BYTES:
            raise HTTPException(status_code=413, detail="artifact too large")
        ref = state.artifacts.add_bytes(
            data,
            kind="upload",
            mime_type=file.content_type or "application/octet-stream",
        )
        return ref.model_dump(mode="json", by_alias=True)

    async def get_artifact(
        artifact_id: str,
        request: Request,
    ) -> FileResponse:
        _validate_http_origin(state, request)
        try:
            record = state.artifacts.get(artifact_id)
        except LocalBridgeError as error:
            raise HTTPException(status_code=404, detail=error.message) from error
        headers = {
            "X-MPE-Artifact-Kind": record.ref.kind,
            "X-MPE-Artifact-Created-At": record.ref.created_at.isoformat(),
        }
        if record.ref.session_id:
            headers["X-MPE-Artifact-Session-Id"] = record.ref.session_id
        if record.ref.run_id:
            headers["X-MPE-Artifact-Run-Id"] = record.ref.run_id
        return FileResponse(
            record.path,
            media_type=record.ref.mime_type,
            filename=record.path.name,
            headers=headers,
        )

    app.add_api_websocket_route("/v2/ws", websocket_endpoint)
    app.add_api_route("/v2/artifacts", upload_artifact, methods=["POST"])
    app.add_api_route("/v2/artifacts/{artifact_id}", get_artifact, methods=["GET"])
    app.add_middleware(
        CORSMiddleware,
        allow_origins=state.config_store.value.server.allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
        expose_headers=[
            "X-MPE-Artifact-Kind",
            "X-MPE-Artifact-Created-At",
            "X-MPE-Artifact-Session-Id",
            "X-MPE-Artifact-Run-Id",
        ],
    )

    app.state.localbridge = state
    return app, state


def _validate_http_origin(state: LocalBridgeState, request: Request) -> None:
    origin = request.headers.get("origin")
    if origin not in set(state.config_store.value.server.allowed_origins):
        raise HTTPException(status_code=403, detail="origin not allowed")
