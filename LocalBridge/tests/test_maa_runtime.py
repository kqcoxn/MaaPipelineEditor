from __future__ import annotations

# pyright: reportPrivateUsage=false
from pathlib import Path

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
