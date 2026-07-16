from __future__ import annotations

# pyright: reportPrivateUsage=false
import asyncio
from pathlib import Path
from typing import Any

import pytest

from mpe_localbridge.artifacts import ArtifactStore
from mpe_localbridge.debug_runtime import DebugManager, DebugRun
from mpe_localbridge.event_log import EventLog


class FakeMaaRuntime:
    async def collect_debug_detail(
        self,
        tasker: Any,
        message: str,
        details: dict[str, Any],
        session_id: str,
        run_id: str,
    ) -> dict[str, Any] | None:
        del tasker, details, session_id, run_id
        if not message.endswith(".Succeeded"):
            return None
        return {
            "kind": "recognition",
            "payload": {"hit": True},
            "artifactRefs": [],
        }


@pytest.mark.asyncio
async def test_snapshot_contains_lifecycle_and_capabilities(tmp_path: Path) -> None:
    emitted: list[tuple[str, dict[str, Any]]] = []

    async def emit(event: str, data: dict[str, Any]) -> None:
        emitted.append((event, data))

    events = EventLog(tmp_path / "events.sqlite3")
    manager = DebugManager(
        FakeMaaRuntime(),  # type: ignore[arg-type]
        events,
        ArtifactStore(tmp_path / "artifacts"),
        emit,
    )
    snapshot = await manager.create("test")
    try:
        assert snapshot["createdAt"]
        assert snapshot["updatedAt"]
        assert snapshot["capabilities"]["pause"] is False
        assert snapshot["capabilities"]["breakpoints"] is False
        assert snapshot["capabilities"]["maa"]["mfwVersion"] == "5.12.1"
    finally:
        await manager.destroy(snapshot["sessionId"])
        events.close()


@pytest.mark.asyncio
async def test_delayed_callback_keeps_original_run_and_appends_detail(
    tmp_path: Path,
) -> None:
    async def emit(event: str, data: dict[str, Any]) -> None:
        del event, data

    events = EventLog(tmp_path / "events.sqlite3")
    manager = DebugManager(
        FakeMaaRuntime(),  # type: ignore[arg-type]
        events,
        ArtifactStore(tmp_path / "artifacts"),
        emit,
    )
    snapshot = await manager.create("test")
    session = manager._sessions[snapshot["sessionId"]]
    old_run = DebugRun(
        run_id="old-run",
        mode="recognition-only",
        entry="Node",
        resolver={
            "Node": {
                "runtimeName": "Node",
                "fileId": "file",
                "nodeId": "node",
                "label": "Node",
            }
        },
        tasker=object(),
    )
    session.run = DebugRun(run_id="new-run", mode="run-from-node", entry="Other")
    await session.queue.put(
        (
            old_run,
            "Node.Recognition.Succeeded",
            {"task_id": 1, "reco_id": 2, "name": "Node"},
        )
    )
    stored = []
    try:
        for _ in range(100):
            stored = events.list(session.session_id)
            if len(stored) == 2:
                break
            await asyncio.sleep(0.01)
        assert [event.run_id for event in stored] == ["old-run", "old-run"]
        assert stored[0].payload["node"]["nodeId"] == "node"
        assert stored[1].parent_seq == stored[0].seq
        assert stored[1].status == "detail-ready"
    finally:
        session.run = None
        await manager.destroy(session.session_id)
        events.close()
