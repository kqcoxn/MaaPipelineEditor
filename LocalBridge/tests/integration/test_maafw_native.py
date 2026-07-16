from __future__ import annotations

import gc
import time
from pathlib import Path

import pytest
from PIL import Image


@pytest.mark.integration
def test_maafw_native_debug_resource_tasker_and_stop(tmp_path: Path) -> None:
    from maa.library import Library
    from maa.resource import Resource
    from maa.tasker import Tasker
    from maa.toolkit import Toolkit

    from mpe_localbridge.fixed_controller import create_fixed_image_controller

    assert Library.version().startswith("v5.12.1")
    Toolkit.init_option(
        tmp_path / "logs",
        {
            "logging": True,
            "debug_mode": True,
            "save_draw": False,
            "stdout_level": 2,
        },
    )

    image_path = tmp_path / "debug.png"
    Image.new("RGB", (64, 64), "white").save(image_path)
    controller = create_fixed_image_controller(image_path)
    resource = Resource()
    tasker = Tasker()
    try:
        assert controller.post_connection().wait().succeeded
        assert resource.override_pipeline(
            {
                "IntegrationLoop": {
                    "recognition": "DirectHit",
                    "action": "DoNothing",
                    "next": ["IntegrationLoop"],
                    "post_delay": 50,
                }
            }
        )
        assert tasker.bind(resource, controller)
        assert tasker.inited

        task = tasker.post_task("IntegrationLoop")
        deadline = time.monotonic() + 3
        while not tasker.running and time.monotonic() < deadline:
            time.sleep(0.01)
        assert tasker.running

        stop = tasker.post_stop().wait()
        assert stop.succeeded
        task.wait()
        assert task.done
        assert not tasker.running
    finally:
        tasker.clear_sinks()
        tasker.clear_context_sinks()
        if tasker.running:
            tasker.post_stop().wait()
        controller.post_inactive().wait()
        del tasker, resource, controller
        gc.collect()
