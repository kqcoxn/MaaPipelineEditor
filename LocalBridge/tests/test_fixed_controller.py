from __future__ import annotations

# pyright: reportPrivateUsage=false
from pathlib import Path

import pytest
from PIL import Image

from mpe_localbridge.fixed_controller import FixedImageController, _load_frames


def test_load_frames_uses_sorted_images_and_bgr(tmp_path: Path) -> None:
    Image.new("RGB", (2, 1), (255, 0, 0)).save(tmp_path / "b.png")
    Image.new("RGB", (2, 1), (0, 255, 0)).save(tmp_path / "a.png")
    (tmp_path / "ignored.txt").write_text("not an image", encoding="utf-8")

    frames = _load_frames(tmp_path)

    assert len(frames) == 2
    assert frames[0].tolist() == [[[0, 255, 0], [0, 255, 0]]]
    assert frames[1].tolist() == [[[0, 0, 255], [0, 0, 255]]]
    assert all(frame.flags.c_contiguous for frame in frames)


def test_load_frames_rejects_empty_directory(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="没有受支持的图片"):
        _load_frames(tmp_path)


@pytest.mark.integration
def test_fixed_image_controller_cycles_preloaded_frames(tmp_path: Path) -> None:
    Image.new("RGB", (2, 1), (255, 0, 0)).save(tmp_path / "1.png")
    Image.new("RGB", (2, 1), (0, 255, 0)).save(tmp_path / "2.png")

    controller = FixedImageController(tmp_path)

    assert controller.connect()
    first = controller.screencap().tolist()
    second = controller.screencap().tolist()
    third = controller.screencap().tolist()
    assert first != second
    assert first == third
