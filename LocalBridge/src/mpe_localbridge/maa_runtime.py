from __future__ import annotations

import asyncio
import io
import json
import logging
import os
import platform
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any, TypeVar, cast

import numpy as np
from PIL import Image

from .artifacts import ArtifactStore
from .config import MaaConfig
from .errors import InvalidArgumentError, LocalBridgeError, NotFoundError
from .fixed_controller import create_fixed_image_controller, fixed_image_controller_mode

T = TypeVar("T")

_ADB_SCREENCAP_METHODS = {
    "EncodeToFileAndPull": 1,
    "Encode": 1 << 1,
    "RawWithGzip": 1 << 2,
    "RawByNetcat": 1 << 3,
    "MinicapDirect": 1 << 4,
    "MinicapStream": 1 << 5,
    "EmulatorExtras": 1 << 6,
}
_ADB_INPUT_METHODS = {
    "AdbShell": 1,
    "MinitouchAndAdbKey": 1 << 1,
    "Maatouch": 1 << 2,
    "EmulatorExtras": 1 << 3,
}
_WIN32_SCREENCAP_METHODS = {
    "GDI": 1,
    "FramePool": 1 << 1,
    "FramePoolWithPseudoMinimize": 1 << 1,
    "DXGI_DesktopDup": 1 << 2,
    "DXGI_DesktopDup_Window": 1 << 3,
    "PrintWindow": 1 << 4,
    "PrintWindowWithPseudoMinimize": 1 << 4,
    "ScreenDC": 1 << 5,
}
_WIN32_INPUT_METHODS = {
    "Seize": 1,
    "SendMessage": 1 << 1,
    "PostMessage": 1 << 2,
    "LegacyEvent": 1 << 3,
    "PostThreadMessage": 1 << 4,
    "SendMessageWithCursorPos": 1 << 5,
    "PostMessageWithCursorPos": 1 << 6,
    "SendMessageWithWindowPos": 1 << 7,
    "PostMessageWithWindowPos": 1 << 8,
    "Interception": 1 << 9,
}
_MACOS_SCREENCAP_METHODS = {"ScreenCaptureKit": 1}
_MACOS_INPUT_METHODS = {"GlobalEvent": 1, "PostToPid": 1 << 1}
_GAMEPAD_TYPES = {"Xbox360": 0, "DualShock4": 1}
_MAAFW_LOG_TAIL_BYTES = 256 * 1024
LOGGER = logging.getLogger(__name__)


class MaaRuntimeService:
    """Serializes non-debug MaaFw access on a dedicated worker."""

    def __init__(self, config: MaaConfig, artifacts: ArtifactStore, log_dir: Path) -> None:
        self.config = config
        self.artifacts = artifacts
        self.log_dir = log_dir
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="maa-runtime")
        self._image_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="maa-image")
        self._controllers: dict[str, Any] = {}
        self._initialized = False

    async def call(self, function: Callable[..., T], *args: Any) -> T:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(self._executor, function, *args)

    async def probe(self) -> dict[str, Any]:
        return await self.call(self._probe_sync)

    async def list_adb_devices(self, specified_adb: str | None = None) -> list[dict[str, Any]]:
        def list_sync() -> list[dict[str, Any]]:
            self._ensure_initialized()
            from maa.toolkit import Toolkit

            devices = Toolkit.find_adb_devices(specified_adb)
            return [
                {
                    "name": item.name,
                    "adb_path": str(item.adb_path),
                    "address": item.address,
                    "screencap_methods": _supported_flag_names(
                        int(item.screencap_methods), _ADB_SCREENCAP_METHODS
                    ),
                    "input_methods": _supported_flag_names(
                        int(item.input_methods), _ADB_INPUT_METHODS
                    ),
                    "config": item.config,
                }
                for item in devices
            ]

        return await self.call(list_sync)

    async def list_desktop_windows(self) -> list[dict[str, Any]]:
        def list_sync() -> list[dict[str, Any]]:
            self._ensure_initialized()
            from maa.toolkit import Toolkit

            return [
                {
                    "hwnd": hex(int(item.hwnd or 0)),
                    "class_name": item.class_name,
                    "window_name": item.window_name,
                    "screencap_methods": list(_WIN32_SCREENCAP_METHODS),
                    "input_methods": list(_WIN32_INPUT_METHODS),
                }
                for item in Toolkit.find_desktop_windows()
            ]

        return await self.call(list_sync)

    async def list_wlroots_compositors(self) -> list[dict[str, str]]:
        def list_sync() -> list[dict[str, str]]:
            runtime_dir_value = os.environ.get("XDG_RUNTIME_DIR", "").strip()
            if not runtime_dir_value:
                return []
            runtime_dir = Path(runtime_dir_value).expanduser().resolve()
            if not runtime_dir.is_dir():
                return []
            names = {path.name for path in runtime_dir.glob("wayland-*") if path.is_socket()}
            current = os.environ.get("WAYLAND_DISPLAY", "").strip()
            if current and (runtime_dir / current).is_socket():
                names.add(current)
            return [
                {
                    "socket_path": str(runtime_dir / name),
                    "name": f"WlRoots {name}",
                }
                for name in sorted(names)
            ]

        return await asyncio.to_thread(list_sync)

    async def create_controller(
        self, controller_type: str, options: dict[str, Any]
    ) -> dict[str, Any]:
        def create_sync() -> dict[str, Any]:
            controller = self._create_controller_sync(controller_type, options)
            connection = controller.post_connection().wait()
            if not connection.succeeded:
                raise LocalBridgeError("maa_controller_connection_failed", "控制器连接失败")
            controller_id = str(uuid.uuid4())
            self._controllers[controller_id] = controller
            return {
                "success": True,
                "controller_id": controller_id,
                "controller_type": controller_type,
                "status": "connected",
            }

        result = await self.call(create_sync)
        LOGGER.info(
            "已连接 %s 控制器: %s",
            controller_type.upper(),
            _controller_display_name(controller_type, options),
        )
        return result

    async def disconnect_controller(self, controller_id: str) -> dict[str, Any]:
        def disconnect_sync() -> dict[str, Any]:
            controller = self._controllers.pop(controller_id, None)
            if controller is None:
                raise NotFoundError("控制器不存在")
            controller.post_inactive().wait()
            return {"success": True, "controller_id": controller_id, "status": "disconnected"}

        result = await self.call(disconnect_sync)
        LOGGER.info("已断开控制器: %s", controller_id)
        return result

    async def screencap(self, controller_id: str, *, force: bool = True) -> dict[str, Any]:
        del force

        def capture_sync() -> Any:
            controller = self._require_controller(controller_id)
            job = controller.post_screencap().wait()
            if not job.succeeded:
                raise LocalBridgeError("maa_screencap_failed", "截图失败")
            return job.get()

        image = await self.call(capture_sync)
        loop = asyncio.get_running_loop()
        data = await loop.run_in_executor(self._image_executor, _encode_numpy_png, image)
        ref = await loop.run_in_executor(
            self._image_executor,
            lambda: self.artifacts.add_bytes(
                data, kind="screenshot", mime_type="image/png"
            ),
        )
        return {
            "success": True,
            "controller_id": controller_id,
            "artifact": ref.model_dump(mode="json", by_alias=True),
        }

    async def controller_command(
        self, controller_id: str, command: str, params: dict[str, Any]
    ) -> dict[str, Any]:
        def execute_sync() -> dict[str, Any]:
            controller = self._require_controller(controller_id)
            methods: dict[str, tuple[str, tuple[Any, ...]]] = {
                "click": (
                    "post_click",
                    (
                        int(params["x"]),
                        int(params["y"]),
                        int(params.get("contact", 0)),
                        int(params.get("pressure", 1)),
                    ),
                ),
                "swipe": (
                    "post_swipe",
                    (
                        int(params["x1"]),
                        int(params["y1"]),
                        int(params["x2"]),
                        int(params["y2"]),
                        int(params.get("duration", 200)),
                        int(params.get("contact", 0)),
                        int(params.get("pressure", 1)),
                    ),
                ),
                "input_text": ("post_input_text", (str(params["text"]),)),
                "start_app": ("post_start_app", (str(params["intent"]),)),
                "stop_app": ("post_stop_app", (str(params["intent"]),)),
                "click_key": (
                    "post_click_key",
                    (_required_int(params, "key", "keycode"),),
                ),
                "key_down": (
                    "post_key_down",
                    (_required_int(params, "key", "keycode"),),
                ),
                "key_up": (
                    "post_key_up",
                    (_required_int(params, "key", "keycode"),),
                ),
                "scroll": (
                    "post_scroll",
                    (int(params.get("dx", 0)), int(params.get("dy", 0))),
                ),
                "shell": ("post_shell", (str(params["command"]),)),
                "touch_down": (
                    "post_touch_down",
                    (
                        int(params["contact"]),
                        int(params["x"]),
                        int(params["y"]),
                        int(params.get("pressure", 1)),
                    ),
                ),
                "touch_move": (
                    "post_touch_move",
                    (
                        int(params["contact"]),
                        int(params["x"]),
                        int(params["y"]),
                        int(params.get("pressure", 1)),
                    ),
                ),
                "touch_up": ("post_touch_up", (int(params["contact"]),)),
                "relative_move": (
                    "post_relative_move",
                    (int(params.get("dx", 0)), int(params.get("dy", 0))),
                ),
                "inactive": ("post_inactive", ()),
            }
            spec = methods.get(command)
            if spec is None:
                raise InvalidArgumentError(f"不支持的控制器命令: {command}")
            method = getattr(controller, spec[0])
            job = method(*spec[1]).wait()
            result: Any = None
            if command == "shell" and job.succeeded:
                result = job.get()
            return {"success": job.succeeded, "command": command, "result": result}

        return await self.call(execute_sync)

    async def execute_action(
        self,
        controller_id: str,
        resource_path: str,
        entry: str,
        pipeline_override: dict[str, Any] | None,
    ) -> dict[str, Any]:
        if not resource_path.strip():
            raise InvalidArgumentError("resource_path 不能为空")
        if not entry.strip():
            raise InvalidArgumentError("entry 不能为空")

        def prepare_sync() -> tuple[Any, Any]:
            from maa.resource import Resource
            from maa.tasker import Tasker

            controller = self._require_controller(controller_id)
            resource = Resource()
            if not resource.post_bundle(resource_path).wait().succeeded:
                raise LocalBridgeError(
                    "maa_resource_load_failed", f"资源加载失败: {resource_path}"
                )
            tasker = Tasker()
            if not tasker.bind(resource, controller) or not tasker.inited:
                raise LocalBridgeError("maa_tasker_init_failed", "Tasker 初始化失败")
            job = tasker.post_task(entry, pipeline_override)
            return tasker, job

        tasker, job = await self.call(prepare_sync)
        try:
            while not await self.call(lambda: bool(job.done)):  # noqa: ASYNC110
                await asyncio.sleep(0.03)
            succeeded = await self.call(lambda: bool(job.succeeded))
            if not succeeded:
                raise LocalBridgeError("maa_action_failed", "节点执行失败")
            detail = await self.call(lambda: job.get())
            return {
                "success": True,
                "message": "节点执行完成",
                "result": serialize_dataclass(detail),
            }
        except asyncio.CancelledError:
            await self.call(lambda: tasker.post_stop().wait())
            raise

    async def read_log_tail(self) -> dict[str, Any]:
        return await asyncio.to_thread(self._read_log_tail_sync)

    async def locate_log(self) -> dict[str, Any]:
        def locate_sync() -> dict[str, Any]:
            path = self.log_dir / "maafw.log"
            exists = path.is_file()
            return {
                "success": self.log_dir.is_dir(),
                "target": "file" if exists else "dir",
                "path": str(path if exists else self.log_dir),
                "message": (
                    "已定位 maafw.log"
                    if exists
                    else "maafw.log 尚不存在, 已定位日志目录"
                ),
            }

        return await asyncio.to_thread(locate_sync)

    def _read_log_tail_sync(self) -> dict[str, Any]:
        path = self.log_dir / "maafw.log"
        base = {"dir": str(self.log_dir), "path": str(path)}
        if not path.is_file():
            return {
                **base,
                "success": False,
                "exists": False,
                "message": "maafw.log 不存在, 可能尚未执行过调试任务",
            }
        stat = path.stat()
        offset = max(0, stat.st_size - _MAAFW_LOG_TAIL_BYTES)
        with path.open("rb") as file:
            file.seek(offset)
            data = file.read()
        if offset:
            _, separator, data = data.partition(b"\n")
            if not separator:
                data = b""
        return {
            **base,
            "success": True,
            "exists": True,
            "content": data.decode("utf-8", errors="replace"),
            "size": stat.st_size,
            "truncated": bool(offset),
            "modTime": stat.st_mtime,
        }

    async def recognize_tool(
        self,
        kind: str,
        base_artifact_id: str,
        params: dict[str, Any],
    ) -> dict[str, Any]:
        template_image: Any = None
        if kind == "template-match":
            template_id = str(params.get("templateArtifactId", ""))
            if not template_id:
                raise InvalidArgumentError("模板匹配缺少 templateArtifactId")
            template_record = self.artifacts.get(template_id)
            loop = asyncio.get_running_loop()
            template_image = await loop.run_in_executor(
                self._image_executor, _decode_image_bgr, template_record.path
            )

        base_record = self.artifacts.get(base_artifact_id)

        def prepare_sync() -> tuple[Any, Any, Any, Any]:
            self._ensure_initialized()
            from maa.resource import Resource
            from maa.tasker import Tasker

            controller = create_fixed_image_controller(base_record.path)
            if not controller.post_connection().wait().succeeded:
                raise LocalBridgeError(
                    "maa_tool_controller_failed", "工具固定图片控制器连接失败"
                )
            resource = Resource()
            if kind == "ocr":
                resource_dir = self.config.resource_dir.strip()
                if not resource_dir:
                    raise LocalBridgeError(
                        "maa_ocr_resource_not_configured",
                        "OCR 资源路径未配置",
                    )
                bundle_job = resource.post_bundle(resource_dir).wait()
                if not bundle_job.succeeded:
                    raise LocalBridgeError(
                        "maa_resource_load_failed", f"OCR 资源加载失败: {resource_dir}"
                    )
            elif kind == "template-match":
                if not resource.override_image("@mpe_template", template_image):
                    raise LocalBridgeError("maa_image_override_failed", "模板图片注入失败")
            else:
                raise InvalidArgumentError(f"未知工具识别类型: {kind}")

            tasker = Tasker()
            if not tasker.bind(resource, controller) or not tasker.inited:
                raise LocalBridgeError("maa_tasker_init_failed", "工具 Tasker 初始化失败")
            entry, pipeline = _tool_pipeline(kind, params)
            job = tasker.post_task(entry, pipeline)
            return controller, resource, tasker, job

        controller, _resource, _tasker, job = await self.call(prepare_sync)
        try:
            while not await self.call(lambda: bool(job.done)):  # noqa: ASYNC110
                await asyncio.sleep(0.03)
            if not await self.call(lambda: bool(job.succeeded)):
                raise LocalBridgeError("maa_tool_recognition_failed", "工具识别任务执行失败")
            payload = await self.call(lambda: _recognition_payload(job.get()))
            payload["baseArtifact"] = base_record.ref.model_dump(mode="json", by_alias=True)
            await self._store_recognition_images(payload)
            return payload
        finally:
            await self.call(lambda: controller.post_inactive().wait())

    async def test_agent(self, profile: dict[str, Any]) -> dict[str, Any]:
        def test_sync() -> dict[str, Any]:
            self._ensure_initialized()
            from maa.agent_client import AgentClient
            from maa.resource import Resource

            transport = str(profile.get("transport", "identifier")).lower()
            if transport == "tcp":
                port = int(profile.get("tcpPort", profile.get("tcp_port", 0)))
                client = AgentClient.create_tcp(port)
            elif transport in {"identifier", "ipc"}:
                identifier = str(profile.get("identifier", "")).strip()
                client = AgentClient(identifier or None)
            else:
                raise InvalidArgumentError(f"不支持的 Agent transport: {transport}")

            timeout_ms = int(profile.get("timeoutMs", profile.get("timeout_ms", 10_000)))
            if not client.set_timeout(max(100, timeout_ms)):
                raise LocalBridgeError("maa_agent_timeout_failed", "设置 Agent 超时失败")
            resource = Resource()
            for value in profile.get("resourcePaths", []):
                resource_path = str(value)
                bundle = resource.post_bundle(resource_path).wait()
                if not bundle.succeeded:
                    raise LocalBridgeError(
                        "maa_resource_load_failed", f"资源加载失败: {resource_path}"
                    )
            if not client.bind(resource):
                raise LocalBridgeError("maa_agent_bind_failed", "Agent 绑定 Resource 失败")
            try:
                if not client.connect() or not client.connected:
                    raise LocalBridgeError("maa_agent_connect_failed", "Agent 连接失败")
                return {
                    "agentId": str(profile.get("id", "agent")),
                    "success": True,
                    "alive": client.alive,
                    "identifier": client.identifier,
                    "recognitions": client.custom_recognition_list,
                    "actions": client.custom_action_list,
                }
            finally:
                if client.connected:
                    client.disconnect()

        return await self.call(test_sync)

    async def _store_recognition_images(
        self,
        payload: dict[str, Any],
        *,
        session_id: str | None = None,
        run_id: str | None = None,
    ) -> None:
        raw_image = payload.pop("_rawImage", None)
        draw_images = payload.pop("_drawImages", [])
        loop = asyncio.get_running_loop()
        refs: list[dict[str, Any]] = []
        if _image_present(raw_image):
            data = await loop.run_in_executor(self._image_executor, _encode_numpy_png, raw_image)
            ref = await loop.run_in_executor(
                self._image_executor,
                lambda: self.artifacts.add_bytes(
                    data,
                    kind="recognition-raw",
                    mime_type="image/png",
                    session_id=session_id,
                    run_id=run_id,
                ),
            )
            payload["rawArtifact"] = ref.model_dump(mode="json", by_alias=True)
            refs.append(payload["rawArtifact"])
        draw_refs: list[dict[str, Any]] = []
        for image in draw_images:
            if not _image_present(image):
                continue
            data = await loop.run_in_executor(self._image_executor, _encode_numpy_png, image)
            ref = await loop.run_in_executor(
                self._image_executor,
                lambda image_data=data: self.artifacts.add_bytes(
                    image_data,
                    kind="recognition-draw",
                    mime_type="image/png",
                    session_id=session_id,
                    run_id=run_id,
                ),
            )
            serialized = ref.model_dump(mode="json", by_alias=True)
            draw_refs.append(serialized)
            refs.append(serialized)
        payload["drawArtifacts"] = draw_refs
        payload["artifactRefs"] = refs

    async def collect_debug_detail(
        self,
        tasker: Any,
        message: str,
        details: dict[str, Any],
        session_id: str,
        run_id: str,
    ) -> dict[str, Any] | None:
        if not message.endswith((".Succeeded", ".Failed")):
            return None

        def query_sync() -> tuple[str, dict[str, Any]] | None:
            if message.startswith("Node.Recognition."):
                recognition = tasker.get_recognition_detail(int(details["reco_id"]))
                if recognition is None:
                    return None
                return "recognition", _recognition_detail_payload(recognition)
            if message.startswith("Node.Action."):
                action = tasker.get_action_detail(int(details["action_id"]))
                if action is None:
                    return None
                return "action", _action_detail_payload(action)
            if message.startswith("Tasker.Task."):
                task = tasker.get_task_detail(int(details["task_id"]))
                if task is None:
                    return None
                return "task", _task_detail_payload(task)
            return None

        queried = await self.call(query_sync)
        if queried is None:
            return None
        kind, payload = queried
        if kind == "recognition":
            await self._store_recognition_images(
                payload, session_id=session_id, run_id=run_id
            )
        image_refs = cast(list[dict[str, Any]], payload.pop("artifactRefs", []))
        serialized = json.dumps(
            _json_safe(payload), ensure_ascii=False, separators=(",", ":")
        ).encode("utf-8")
        loop = asyncio.get_running_loop()
        detail_ref = await loop.run_in_executor(
            self._image_executor,
            lambda: self.artifacts.add_bytes(
                serialized,
                kind=f"{kind}-detail",
                mime_type="application/json",
                session_id=session_id,
                run_id=run_id,
            ),
        )
        return {
            "kind": kind,
            "payload": payload,
            "artifactRefs": [
                detail_ref.model_dump(mode="json", by_alias=True),
                *image_refs,
            ],
        }

    def create_debug_objects(
        self,
        controller_type: str,
        controller_options: dict[str, Any],
        resource_paths: list[str],
        agent_profiles: list[dict[str, Any]],
    ) -> tuple[Any, Any, Any, list[Any]]:
        self._ensure_initialized()
        from maa.resource import Resource
        from maa.tasker import Tasker

        controller = self._create_controller_sync(controller_type, controller_options)
        if not controller.post_connection().wait().succeeded:
            raise LocalBridgeError("maa_controller_connection_failed", "调试控制器连接失败")
        resource = Resource()
        for resource_path in resource_paths:
            if not resource.post_bundle(resource_path).wait().succeeded:
                raise LocalBridgeError(
                    "maa_resource_load_failed", f"资源加载失败: {resource_path}"
                )
        tasker = Tasker()
        if not tasker.bind(resource, controller) or not tasker.inited:
            raise LocalBridgeError("maa_tasker_init_failed", "Tasker 初始化失败")
        agents: list[Any] = []
        for profile in agent_profiles:
            if not bool(profile.get("enabled", True)):
                continue
            try:
                client = self._connect_agent_sync(profile, resource)
            except Exception:
                if bool(profile.get("required", False)):
                    raise
                continue
            agents.append(client)
        return controller, resource, tasker, agents

    async def release_debug_objects(
        self, controller: Any, tasker: Any, agents: list[Any]
    ) -> None:
        def release_sync() -> None:
            if tasker is not None:
                tasker.clear_sinks()
                tasker.clear_context_sinks()
                if tasker.running:
                    tasker.post_stop().wait()
            for agent in agents:
                if agent.connected:
                    agent.disconnect()
            if controller is not None:
                controller.post_inactive().wait()

        await self.call(release_sync)

    async def close(self) -> None:
        def close_sync() -> None:
            for controller in self._controllers.values():
                controller.post_inactive().wait()
            self._controllers.clear()

        await self.call(close_sync)
        self._executor.shutdown(wait=True, cancel_futures=True)
        self._image_executor.shutdown(wait=True, cancel_futures=True)

    def _probe_sync(self) -> dict[str, Any]:
        try:
            self._ensure_initialized()
            from maa.library import Library

            return {
                "available": True,
                "version": Library.version(),
                "platform": platform.system().lower(),
                "fixedImageController": fixed_image_controller_mode(),
            }
        except Exception as error:
            return {"available": False, "version": "", "error": str(error)}

    def _ensure_initialized(self) -> None:
        if self._initialized:
            return
        from maa.toolkit import Toolkit

        self.log_dir.mkdir(parents=True, exist_ok=True)
        Toolkit.init_option(
            self.log_dir,
            {
                "logging": True,
                "debug_mode": self.config.debug_mode,
                "save_draw": False,
                "stdout_level": 2,
            },
        )
        self._initialized = True

    def _create_controller_sync(self, controller_type: str, options: dict[str, Any]) -> Any:
        self._ensure_initialized()
        from maa.controller import (
            AdbController,
            GamepadController,
            MacOSController,
            PlayCoverController,
            Win32Controller,
            WlRootsController,
        )

        normalized = controller_type.lower()
        if normalized == "adb":
            return AdbController(
                adb_path=options["adb_path"],
                address=options["address"],
                screencap_methods=_flags_value(
                    options.get("screencap_methods"), _ADB_SCREENCAP_METHODS, 71
                ),
                input_methods=_flags_value(
                    options.get("input_methods"), _ADB_INPUT_METHODS, 7
                ),
                config=_config_object(options.get("config")),
            )
        if normalized == "win32":
            input_method = options.get("input_method")
            return Win32Controller(
                hWnd=_integer_value(options["hwnd"]),
                screencap_method=_enum_value(
                    options.get("screencap_method"), _WIN32_SCREENCAP_METHODS, 18
                ),
                mouse_method=_enum_value(
                    options.get("mouse_method", input_method), _WIN32_INPUT_METHODS, 1
                ),
                keyboard_method=_enum_value(
                    options.get("keyboard_method", input_method), _WIN32_INPUT_METHODS, 1
                ),
            )
        if normalized in {"wlroots", "wl_roots"}:
            return WlRootsController(
                wlr_socket_path=str(
                    options.get("wlr_socket_path", options.get("socket_path", ""))
                ),
                use_win32_vk_code=bool(options.get("use_win32_vk_code", False)),
            )
        if normalized == "macos":
            return MacOSController(
                window_id=_required_int(options, "window_id", "pid"),
                screencap_method=_enum_value(
                    options.get("screencap_method"), _MACOS_SCREENCAP_METHODS, 1
                ),
                input_method=_enum_value(
                    options.get("input_method"), _MACOS_INPUT_METHODS, 1
                ),
            )
        if normalized == "playcover":
            return PlayCoverController(str(options["address"]), str(options["uuid"]))
        if normalized == "gamepad":
            return GamepadController(
                _integer_value(options.get("hwnd", 0)),
                _enum_value(options.get("gamepad_type"), _GAMEPAD_TYPES, 0),
                _enum_value(
                    options.get("screencap_method"), _WIN32_SCREENCAP_METHODS, 2
                ),
            )
        if normalized in {"dbg", "debug", "fixed"}:
            return create_fixed_image_controller(str(options["read_path"]))
        raise InvalidArgumentError(f"不支持的控制器类型: {controller_type}")

    def _require_controller(self, controller_id: str) -> Any:
        controller = self._controllers.get(controller_id)
        if controller is None:
            raise NotFoundError("控制器不存在")
        return controller

    def _connect_agent_sync(self, profile: dict[str, Any], resource: Any) -> Any:
        from maa.agent_client import AgentClient

        transport = str(profile.get("transport", "identifier")).lower()
        if transport == "tcp":
            port = int(profile.get("tcpPort", profile.get("tcp_port", 0)))
            client = AgentClient.create_tcp(port)
        elif transport in {"identifier", "ipc"}:
            identifier = str(profile.get("identifier", "")).strip()
            client = AgentClient(identifier or None)
        else:
            raise InvalidArgumentError(f"不支持的 Agent transport: {transport}")
        timeout_ms = int(profile.get("timeoutMs", profile.get("timeout_ms", 10_000)))
        if not client.set_timeout(max(100, timeout_ms)):
            raise LocalBridgeError("maa_agent_timeout_failed", "设置 Agent 超时失败")
        if not client.bind(resource):
            raise LocalBridgeError("maa_agent_bind_failed", "Agent 绑定 Resource 失败")
        if not client.connect() or not client.connected:
            raise LocalBridgeError("maa_agent_connect_failed", "Agent 连接失败")
        return client


def _encode_numpy_png(value: Any) -> bytes:
    shape = getattr(value, "shape", ())
    if len(shape) == 3 and shape[2] == 3:
        value = value[:, :, ::-1]
    elif len(shape) == 3 and shape[2] == 4:
        value = value[:, :, [2, 1, 0, 3]]
    image = Image.fromarray(value)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _decode_image_bgr(path: Path) -> Any:
    try:
        with Image.open(path) as image:
            rgb = np.asarray(image.convert("RGB"))
    except OSError as error:
        raise InvalidArgumentError("artifact 不是可识别的图片") from error
    return np.ascontiguousarray(rgb[:, :, ::-1])


def _tool_pipeline(kind: str, params: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    entry = "@mpe_tool"
    roi = [int(value) for value in params.get("roi", [0, 0, 0, 0])]
    if len(roi) != 4:
        raise InvalidArgumentError("roi 必须包含四个整数")
    if kind == "ocr":
        node: dict[str, Any] = {
            "recognition": "OCR",
            "roi": roi,
            "action": "DoNothing",
        }
        if params.get("model"):
            node["model"] = str(params["model"])
    else:
        node = {
            "recognition": "TemplateMatch",
            "template": "@mpe_template",
            "roi": roi,
            "threshold": float(params.get("threshold", 0.7)),
            "method": int(params.get("method", 5)),
            "green_mask": bool(params.get("greenMask", params.get("green_mask", False))),
            "action": "DoNothing",
        }
    return entry, {entry: node}


def _recognition_payload(task_detail: Any) -> dict[str, Any]:
    if task_detail is None or not task_detail.nodes:
        return {
            "success": True,
            "hit": False,
            "text": "",
            "boxes": [],
            "all": [],
            "best": None,
            "noContent": True,
            "_rawImage": None,
            "_drawImages": [],
        }
    recognition = task_detail.nodes[-1].recognition
    if recognition is None:
        raise LocalBridgeError("maa_recognition_detail_missing", "未能读取识别详情")
    return _recognition_detail_payload(recognition)


def _recognition_detail_payload(recognition: Any) -> dict[str, Any]:
    all_results = [_recognition_result(value) for value in recognition.all_results]
    filtered_results = [
        _recognition_result(value) for value in recognition.filtered_results
    ]
    best = (
        _recognition_result(recognition.best_result)
        if recognition.best_result is not None
        else None
    )
    text_items = [str(item["text"]) for item in all_results if item.get("text")]
    boxes = [item for item in all_results if "box" in item]
    return {
        "success": True,
        "hit": bool(recognition.hit),
        "algorithm": getattr(recognition.algorithm, "value", str(recognition.algorithm)),
        "box": _rect_payload(recognition.box),
        "rawDetail": recognition.raw_detail,
        "allResults": all_results,
        "filteredResults": filtered_results,
        "bestResult": best,
        "text": "\n".join(text_items),
        "boxes": [_flatten_result_box(item) for item in boxes],
        "all": [_flatten_result_box(item) for item in all_results],
        "best": _flatten_result_box(best) if best is not None else None,
        "noContent": not bool(text_items or all_results),
        "_rawImage": recognition.raw_image,
        "_drawImages": recognition.draw_images,
    }


def _action_detail_payload(action: Any) -> dict[str, Any]:
    return {
        "id": int(action.action_id),
        "name": str(action.name),
        "action": getattr(action.action, "value", str(action.action)),
        "box": _rect_payload(action.box),
        "success": bool(action.success),
        "result": _json_safe(action.result),
        "rawDetail": _json_safe(action.raw_detail),
    }


def _task_detail_payload(task: Any) -> dict[str, Any]:
    return {
        "id": int(task.task_id),
        "entry": str(task.entry),
        "status": getattr(task.status, "name", str(task.status)).lower(),
        "nodeIds": [int(value) for value in task.node_id_list],
    }


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, str | int | float | bool):
        return value
    if is_dataclass(value) and not isinstance(value, type):
        return _json_safe(asdict(value))
    if isinstance(value, dict):
        mapping = cast(dict[Any, Any], value)
        return {str(key): _json_safe(item) for key, item in mapping.items()}
    if isinstance(value, list | tuple):
        return [_json_safe(item) for item in cast(list[Any] | tuple[Any, ...], value)]
    enum_value = getattr(value, "value", None)
    if isinstance(enum_value, str | int):
        return enum_value
    return str(value)


def _recognition_result(value: Any) -> dict[str, Any]:
    result: dict[str, Any] = {}
    box = getattr(value, "box", None)
    if box is not None:
        result["box"] = _rect_payload(box)
    for field_name in ("score", "text", "count", "label", "cls_index", "detail"):
        if hasattr(value, field_name):
            result[field_name] = getattr(value, field_name)
    return result


def _rect_payload(value: Any) -> dict[str, int] | None:
    if value is None:
        return None
    return {
        "x": int(value.x),
        "y": int(value.y),
        "width": int(value.w),
        "height": int(value.h),
    }


def _flatten_result_box(value: dict[str, Any]) -> dict[str, Any]:
    result = dict(value)
    box = result.pop("box", None)
    if isinstance(box, dict):
        mapping = cast(dict[Any, Any], box)
        normalized: dict[str, Any] = {str(key): item for key, item in mapping.items()}
        result = {**normalized, **result}
    return result


def _image_present(value: Any) -> bool:
    return value is not None and bool(getattr(value, "size", 0))


def _controller_display_name(controller_type: str, options: dict[str, Any]) -> str:
    for key in ("name", "address", "window_name", "hwnd", "pid", "socket_path"):
        value = str(options.get(key, "")).strip()
        if value:
            return value
    return controller_type


def _required_int(params: dict[str, Any], primary: str, fallback: str) -> int:
    value = params.get(primary)
    if value is None:
        value = params.get(fallback)
    if value is None:
        raise InvalidArgumentError(f"缺少参数: {primary}")
    return _integer_value(value)


def _integer_value(value: Any) -> int:
    if isinstance(value, str):
        return int(value, 0)
    return int(value)


def _enum_value(value: Any, mapping: dict[str, int], default: int) -> int:
    if value is None or value == "":
        return default
    if isinstance(value, str) and value in mapping:
        return mapping[value]
    return _integer_value(value)


def _flags_value(value: Any, mapping: dict[str, int], default: int) -> int:
    if value is None or value == [] or value == "":
        return default
    if isinstance(value, list):
        result = 0
        for item in cast(list[Any], value):
            result |= _enum_value(item, mapping, 0)
        return result
    return _enum_value(value, mapping, default)


def _supported_flag_names(value: int, mapping: dict[str, int]) -> list[str]:
    return [name for name, flag in mapping.items() if value & flag == flag]


def _config_object(value: Any) -> dict[str, Any]:
    if value is None or value == "":
        return {}
    if isinstance(value, dict):
        mapping = cast(dict[Any, Any], value)
        return {str(key): item for key, item in mapping.items()}
    if isinstance(value, str):
        parsed = json.loads(value)
        if isinstance(parsed, dict):
            mapping = cast(dict[Any, Any], parsed)
            return {str(key): item for key, item in mapping.items()}
    raise InvalidArgumentError("ADB config 必须是 JSON 对象")


def serialize_dataclass(value: Any) -> Any:
    if is_dataclass(value) and not isinstance(value, type):
        return asdict(value)
    return value
