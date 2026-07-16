from __future__ import annotations

import threading
import uuid
from pathlib import Path
from typing import Any

import numpy as np
from maa.controller import CustomController
from maa.library import Library
from PIL import Image

_IMAGE_SUFFIXES = {".bmp", ".jpeg", ".jpg", ".png", ".webp"}


class FixedImageController(CustomController):
    """MaaFw custom controller backed by immutable, preloaded image frames."""

    def __init__(self, read_path: str | Path) -> None:
        self._read_path = Path(read_path).expanduser().resolve()
        self._frames = tuple(_load_frames(self._read_path))
        self._frame_index = 0
        self._lock = threading.Lock()
        self._uuid = f"mpe-fixed-{uuid.uuid5(uuid.NAMESPACE_URL, self._read_path.as_uri())}"
        super().__init__()

    def connect(self) -> bool:
        return bool(self._frames)

    def request_uuid(self) -> str:
        return self._uuid

    def start_app(self, intent: str) -> bool:
        del intent
        return True

    def stop_app(self, intent: str) -> bool:
        del intent
        return True

    def screencap(self) -> np.ndarray:
        with self._lock:
            frame = self._frames[self._frame_index]
            self._frame_index = (self._frame_index + 1) % len(self._frames)
        return frame

    def click(self, x: int, y: int) -> bool:
        del x, y
        return True

    def swipe(self, x1: int, y1: int, x2: int, y2: int, duration: int) -> bool:
        del x1, y1, x2, y2, duration
        return True

    def touch_down(self, contact: int, x: int, y: int, pressure: int) -> bool:
        del contact, x, y, pressure
        return True

    def touch_move(self, contact: int, x: int, y: int, pressure: int) -> bool:
        del contact, x, y, pressure
        return True

    def touch_up(self, contact: int) -> bool:
        del contact
        return True

    def click_key(self, keycode: int) -> bool:
        del keycode
        return True

    def input_text(self, text: str) -> bool:
        del text
        return True

    def key_down(self, keycode: int) -> bool:
        del keycode
        return True

    def key_up(self, keycode: int) -> bool:
        del keycode
        return True

    def scroll(self, dx: int, dy: int) -> bool:
        del dx, dy
        return True

    def relative_move(self, dx: int, dy: int) -> bool:
        del dx, dy
        return True

    def get_custom_info(self) -> dict[str, Any]:
        return {
            "controller": "mpe-fixed-image",
            "frameCount": len(self._frames),
            "readPath": str(self._read_path),
        }


def native_dbg_controller_available() -> bool:
    binary_dir = Library.framework_libpath.parent if Library.framework_libpath else None
    if binary_dir is None or not binary_dir.is_dir():
        return False
    return any(
        "maadbgcontrolunit" in path.name.casefold()
        for path in binary_dir.rglob("*")
        if path.is_file()
    )


def fixed_image_controller_mode() -> str:
    return "native-dbg" if native_dbg_controller_available() else "custom-fallback"


def create_fixed_image_controller(read_path: str | Path) -> Any:
    if native_dbg_controller_available():
        from maa.controller import DbgController

        try:
            return DbgController(read_path)
        except (OSError, RuntimeError):
            pass
    return FixedImageController(read_path)


def _load_frames(read_path: Path) -> list[np.ndarray]:
    if read_path.is_file():
        paths = [read_path]
    elif read_path.is_dir():
        paths = sorted(
            (
                path
                for path in read_path.iterdir()
                if path.is_file() and path.suffix.casefold() in _IMAGE_SUFFIXES
            ),
            key=lambda path: path.name.casefold(),
        )
    else:
        raise FileNotFoundError(f"固定图片路径不存在: {read_path}")
    if not paths:
        raise ValueError(f"固定图片路径中没有受支持的图片: {read_path}")

    frames: list[np.ndarray] = []
    for path in paths:
        with Image.open(path) as image:
            rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)
            frames.append(np.ascontiguousarray(rgb[:, :, ::-1]))
    return frames
