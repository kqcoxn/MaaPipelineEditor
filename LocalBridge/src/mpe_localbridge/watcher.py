from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable, Iterable
from pathlib import Path
from typing import Any

from watchfiles import Change, awatch  # pyright: ignore[reportUnknownVariableType]

from .workspace import Workspace

Emit = Callable[[str, dict[str, Any]], Awaitable[None]]
LOGGER = logging.getLogger(__name__)


class WorkspaceWatcher:
    def __init__(self, workspace: Workspace, emit: Emit) -> None:
        self.workspace = workspace
        self.emit = emit
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
                for event in events:
                    await self.emit("file.changed", event)
                await self.emit("workspace.files", self.workspace.snapshot())
        except asyncio.CancelledError:
            raise
        except Exception:
            LOGGER.exception("Workspace watcher stopped unexpectedly")


def normalize_changes(
    workspace: Workspace, changes: Iterable[tuple[Change, str]]
) -> list[dict[str, Any]]:
    priorities = {Change.modified: 1, Change.added: 2, Change.deleted: 3}
    merged: dict[str, tuple[Change, bool]] = {}
    for change, raw_path in changes:
        path = Path(raw_path)
        event_path = workspace.event_path(path)
        if event_path is None:
            continue
        relative_path, is_directory = event_path
        if change != Change.deleted and not is_directory and workspace.is_own_write(path):
            continue
        previous = merged.get(relative_path)
        if previous is None or priorities[change] >= priorities[previous[0]]:
            merged[relative_path] = (change, is_directory)
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
        }
        for relative_path, (change, is_directory) in sorted(merged.items())
    ]
