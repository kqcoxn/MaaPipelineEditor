from __future__ import annotations

# pyright: reportPrivateUsage=false
import logging
from pathlib import Path
from typing import Any

import pytest

from mpe_localbridge.artifacts import ArtifactStore
from mpe_localbridge.config import MaaConfig
from mpe_localbridge.errors import InvalidArgumentError
from mpe_localbridge.maa_runtime import (
    _ADB_INPUT_METHODS,
    _ADB_SCREENCAP_METHODS,
    MaaRuntimeService,
    _config_object,
    _enum_value,
    _flags_value,
    _integer_value,
)


def test_controller_option_values_accept_protocol_names() -> None:
    assert _flags_value(
        ["Encode", "RawWithGzip"], _ADB_SCREENCAP_METHODS, 0
    ) == (1 << 1) | (1 << 2)
    assert _flags_value(["Maatouch"], _ADB_INPUT_METHODS, 0) == 1 << 2
    assert _enum_value("DualShock4", {"Xbox360": 0, "DualShock4": 1}, 0) == 1
    assert _integer_value("0x10") == 16


def test_controller_option_values_reject_unknown_names() -> None:
    with pytest.raises(ValueError):
        _enum_value("Unknown", {"Known": 1}, 0)
    with pytest.raises(InvalidArgumentError):
        _config_object("[]")


@pytest.mark.asyncio
async def test_log_tail_is_bounded_and_utf8_safe(tmp_path: Path) -> None:
    log_dir = tmp_path / "logs"
    log_dir.mkdir()
    path = log_dir / "maafw.log"
    path.write_bytes(b"discard\n" + b"x" * (256 * 1024) + "中文".encode())
    runtime = MaaRuntimeService(MaaConfig(), ArtifactStore(tmp_path / "artifacts"), log_dir)
    try:
        result = await runtime.read_log_tail()
    finally:
        await runtime.close()

    assert result["success"] is True
    assert result["truncated"] is True
    assert len(result["content"].encode("utf-8")) <= 256 * 1024


@pytest.mark.asyncio
async def test_controller_connection_emits_user_facing_info(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    class SuccessfulJob:
        succeeded = True

        def wait(self) -> SuccessfulJob:
            return self

    class Controller:
        def post_connection(self) -> SuccessfulJob:
            return SuccessfulJob()

        def post_inactive(self) -> SuccessfulJob:
            return SuccessfulJob()

    runtime = MaaRuntimeService(
        MaaConfig(), ArtifactStore(tmp_path / "artifacts"), tmp_path / "logs"
    )

    def create_controller(_controller_type: str, _options: dict[str, Any]) -> Controller:
        return Controller()

    monkeypatch.setattr(runtime, "_create_controller_sync", create_controller)
    caplog.set_level(logging.INFO, logger="mpe_localbridge.maa_runtime")
    try:
        result: dict[str, Any] = await runtime.create_controller(
            "adb", {"name": "MuMu 12", "address": "127.0.0.1:16384"}
        )
        await runtime.disconnect_controller(str(result["controller_id"]))
    finally:
        await runtime.close()

    assert "已连接 ADB 控制器: MuMu 12" in caplog.messages


@pytest.mark.asyncio
async def test_debug_runtime_reuses_connected_controller_without_deactivating_it(
    tmp_path: Path,
) -> None:
    class SuccessfulJob:
        succeeded = True

        def wait(self) -> SuccessfulJob:
            return self

    class Controller:
        inactive_calls = 0

        def post_inactive(self) -> SuccessfulJob:
            self.inactive_calls += 1
            return SuccessfulJob()

    class Tasker:
        running = False

        def clear_sinks(self) -> None:
            pass

        def clear_context_sinks(self) -> None:
            pass

    runtime = MaaRuntimeService(
        MaaConfig(), ArtifactStore(tmp_path / "artifacts"), tmp_path / "logs"
    )
    controller = Controller()
    runtime._controllers["controller-1"] = controller
    try:
        resolved, owns_controller = runtime._resolve_debug_controller(
            "win32", {"controllerId": "controller-1"}
        )
        assert resolved is controller
        assert owns_controller is False

        await runtime.release_debug_objects(
            resolved,
            Tasker(),
            [],
            deactivate_controller=owns_controller,
        )
        assert controller.inactive_calls == 0
    finally:
        runtime._controllers.clear()
        await runtime.close()
