from __future__ import annotations

from typing import Any


class LocalBridgeError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        data: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.data = data


class InvalidArgumentError(LocalBridgeError):
    def __init__(self, message: str, *, data: dict[str, Any] | None = None) -> None:
        super().__init__("invalid_argument", message, data=data)


class NotFoundError(LocalBridgeError):
    def __init__(self, message: str, *, data: dict[str, Any] | None = None) -> None:
        super().__init__("not_found", message, data=data)


class ConflictError(LocalBridgeError):
    def __init__(self, message: str, *, data: dict[str, Any] | None = None) -> None:
        super().__init__("conflict", message, data=data)


class ForbiddenError(LocalBridgeError):
    def __init__(self, message: str) -> None:
        super().__init__("forbidden", message)
