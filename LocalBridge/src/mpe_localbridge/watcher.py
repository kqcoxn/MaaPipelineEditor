from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable, Iterable
from pathlib import Path
from typing import Any

from watchfiles import Change, awatch  # pyright: ignore[reportUnknownVariableType]

from .workspace import Workspace

ChangeHandler = Callable[
    [list[dict[str, Any]], bool, list[dict[str, Any]]],
    Awaitable[None],
]
LOGGER = logging.getLogger(__name__)


class WorkspaceWatcher:
    def __init__(self, workspace: Workspace, on_change: ChangeHandler) -> None:
        self.workspace = workspace
        self.on_change = on_change
        self._task: asyncio.Task[None] | None = None
        self._stop_event: asyncio.Event | None = None

    async def start(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._stop_event = asyncio.Event()
        self._task = asyncio.create_task(self._run(), name="workspace-watcher")

    async def restart(self) -> None:
        await self.close()
        await self.start()

    async def close(self) -> None:
        task = self._task
        stop_event = self._stop_event
        self._task = None
        self._stop_event = None
        if task is None:
            return
        if stop_event is not None:
            stop_event.set()
        try:
            await asyncio.wait_for(task, timeout=2)
        except TimeoutError:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)

    async def _run(self) -> None:
        stop_event = self._stop_event
        if stop_event is None:
            return
        if not self.workspace.root.is_dir():
            return
        try:
            async for changes in awatch(
                self.workspace.root,
                debounce=150,
                step=50,
                stop_event=stop_event,
                recursive=True,
            ):
                events = normalize_changes(self.workspace, changes)
                if not events:
                    continue
                public_events, needs_discovery, pipeline_events = prepare_changes(events)
                await self.on_change(public_events, needs_discovery, pipeline_events)
        except asyncio.CancelledError:
            raise
        except Exception:
            LOGGER.exception("Workspace watcher stopped unexpectedly")


def normalize_changes(
    workspace: Workspace, changes: Iterable[tuple[Change, str]]
) -> list[dict[str, Any]]:
    priorities = {Change.modified: 1, Change.added: 2, Change.deleted: 3}
    merged: dict[str, tuple[Change, bool, str]] = {}
    for change, raw_path in changes:
        path = Path(raw_path)
        workspace_kind = workspace.change_kind(path)
        if workspace_kind is None:
            continue
        event_path = workspace.event_path(path)
        if event_path is None:
            continue
        relative_path, is_directory = event_path
        previous = merged.get(relative_path)
        if previous is None or priorities[change] >= priorities[previous[0]]:
            merged[relative_path] = (change, is_directory, workspace_kind)
    names = {
        Change.added: "created",
        Change.modified: "modified",
        Change.deleted: "deleted",
    }
    return [
        {
            "type": names[change],
            "file_path": relative_path,
            "is_directory": is_directory,
            "workspace_kind": workspace_kind,
        }
        for relative_path, (change, is_directory, workspace_kind) in sorted(merged.items())
    ]


def prepare_changes(
    events: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], bool, list[dict[str, Any]]]:
    needs_discovery = any(event.get("workspace_kind") == "interface" for event in events)
    pipeline_events = [
        event for event in events if event.get("workspace_kind") == "pipeline"
    ]
    public_events = [
        {key: value for key, value in event.items() if key != "workspace_kind"}
        for event in events
    ]
    return public_events, needs_discovery, [
        {key: value for key, value in event.items() if key != "workspace_kind"}
        for event in pipeline_events
    ]
