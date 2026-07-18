from __future__ import annotations

import logging

_FRAMEWORK_LOGGERS = (
    "uvicorn.error",
    "uvicorn.asgi",
    "httpx",
    "httpcore",
    "watchfiles.main",
)
_IGNORED_DEBUG_MESSAGES = {
    ("watchfiles.main", "rust notify timeout, continuing"),
}


class FrameworkInfoToDebugFilter(logging.Filter):
    def __init__(self, output_level: int = logging.DEBUG) -> None:
        super().__init__()
        self.output_level = output_level

    def filter(self, record: logging.LogRecord) -> bool:
        if record.levelno == logging.DEBUG and (
            record.name,
            record.getMessage(),
        ) in _IGNORED_DEBUG_MESSAGES:
            return False
        is_framework_log = any(
            record.name == name or record.name.startswith(f"{name}.")
            for name in _FRAMEWORK_LOGGERS
        )
        if is_framework_log and record.levelno == logging.INFO:
            record.levelno = logging.DEBUG
            record.levelname = logging.getLevelName(logging.DEBUG)
        return record.levelno >= self.output_level


def configure_logging(level_name: str) -> int:
    level = getattr(logging, level_name.upper(), logging.INFO)
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        force=True,
    )
    root = logging.getLogger()
    root.setLevel(logging.DEBUG)
    for handler in root.handlers:
        handler.setLevel(logging.DEBUG)
        handler.filters = [
            filter_
            for filter_ in handler.filters
            if not isinstance(filter_, FrameworkInfoToDebugFilter)
        ]
        handler.addFilter(FrameworkInfoToDebugFilter(level))

    for logger_name in _FRAMEWORK_LOGGERS:
        logger = logging.getLogger(logger_name)
        logger.setLevel(logging.DEBUG)
    return level
