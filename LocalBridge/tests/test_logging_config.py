from __future__ import annotations

import logging

from mpe_localbridge.logging_config import FrameworkInfoToDebugFilter


def test_framework_info_filter_demotes_only_info_records() -> None:
    filter_ = FrameworkInfoToDebugFilter()
    info = logging.LogRecord("httpcore.connection", logging.INFO, "", 0, "started", (), None)
    app_info = logging.LogRecord("mpe_localbridge.server", logging.INFO, "", 0, "ready", (), None)
    warning = logging.LogRecord("uvicorn.error", logging.WARNING, "", 0, "warning", (), None)

    assert filter_.filter(info) is True
    assert info.levelno == logging.DEBUG
    assert info.levelname == "DEBUG"
    assert filter_.filter(app_info) is True
    assert app_info.levelno == logging.INFO
    assert filter_.filter(warning) is True
    assert warning.levelno == logging.WARNING


def test_info_filter_suppresses_framework_info_and_keeps_app_info() -> None:
    filter_ = FrameworkInfoToDebugFilter(logging.INFO)
    framework_info = logging.LogRecord(
        "httpcore.connection", logging.INFO, "", 0, "connect", (), None
    )
    app_info = logging.LogRecord(
        "mpe_localbridge.server", logging.INFO, "", 0, "connected", (), None
    )

    assert filter_.filter(framework_info) is False
    assert filter_.filter(app_info) is True
