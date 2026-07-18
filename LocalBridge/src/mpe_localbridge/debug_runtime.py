from __future__ import annotations

import asyncio
import copy
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal, cast

from .artifacts import ArtifactStore
from .errors import ConflictError, InvalidArgumentError, NotFoundError
from .event_log import EventLog
from .maa_runtime import MaaRuntimeService
from .models import ArtifactRef, DebugEvent

Emit = Callable[[str, dict[str, Any]], Awaitable[None]]
SessionStatus = Literal["idle", "preparing", "running", "stopping", "error", "disposed"]
RunStatus = Literal["preparing", "running", "completed", "failed", "stopped"]


@dataclass(slots=True)
class DebugRun:
    run_id: str
    mode: str
    entry: str
    status: RunStatus = "preparing"
    started_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = None
    resolver: dict[str, dict[str, Any]] = field(
        default_factory=lambda: dict[str, dict[str, Any]]()
    )
    job: Any = None
    tasker: Any = None
    wait_task: asyncio.Task[None] | None = None


@dataclass(slots=True)
class DebugSession:
    session_id: str
    name: str
    status: SessionStatus = "idle"
    run: DebugRun | None = None
    controller: Any = None
    owns_controller: bool = False
    resource: Any = None
    tasker: Any = None
    sink: Any = None
    agents: list[Any] = field(default_factory=lambda: list[Any]())
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    queue: asyncio.Queue[tuple[DebugRun, str, dict[str, Any]]] = field(
        default_factory=lambda: asyncio.Queue[tuple[DebugRun, str, dict[str, Any]]]()
    )
    consumer: asyncio.Task[None] | None = None


class DebugManager:
    def __init__(
        self,
        maa: MaaRuntimeService,
        events: EventLog,
        artifacts: ArtifactStore,
        emit: Emit,
    ) -> None:
        self.maa = maa
        self.events = events
        self.artifacts = artifacts
        self.emit = emit
        self._sessions: dict[str, DebugSession] = {}
        self._lock = asyncio.Lock()

    def capabilities(self) -> dict[str, Any]:
        return {
            "generation": "debug-v2",
            "runModes": [
                "run-from-node",
                "single-node-run",
                "recognition-only",
                "action-only",
            ],
            "diagnostics": ["resource-preflight", "resource-health"],
            "artifacts": ["screenshot", "recognition-detail", "performance-summary"],
            "screenshotSources": ["controller", "debug-input"],
            "profileFeatures": ["memory-snapshot", "save-open-files"],
            "debugFeatures": ["event-resume", "local-replay"],
            "pause": False,
            "breakpoints": False,
            "maa": {
                "mfwVersion": "5.12.1",
                "supportedControllers": [
                    "adb",
                    "win32",
                    "wlroots",
                    "macos",
                    "playcover",
                    "gamepad",
                    "dbg",
                ],
                "supportedTaskerApis": ["post_task", "post_stop", "pipeline_override"],
                "supportedResourceApis": ["post_bundle", "override_pipeline", "override_image"],
                "supportedAgentTransports": ["identifier", "tcp"],
            },
        }

    async def create(self, name: str = "Debug Session") -> dict[str, Any]:
        async with self._lock:
            session_id = str(uuid.uuid4())
            session = DebugSession(session_id=session_id, name=name)
            session.consumer = asyncio.create_task(
                self._consume(session), name=f"debug-consumer-{session_id}"
            )
            self._sessions[session_id] = session
        snapshot = self.snapshot(session_id)
        await self.emit("debug.sessionCreated", snapshot)
        return snapshot

    def snapshot(self, session_id: str) -> dict[str, Any]:
        session = self._require(session_id)
        run = session.run
        return {
            "sessionId": session.session_id,
            "name": session.name,
            "status": session.status,
            "createdAt": session.created_at.isoformat(),
            "updatedAt": session.updated_at.isoformat(),
            "capabilities": self.capabilities(),
            "activeRun": None
            if run is None
            else {
                "runId": run.run_id,
                "mode": run.mode,
                "entry": run.entry,
                "status": run.status,
                "startedAt": run.started_at.isoformat(),
                "completedAt": run.completed_at.isoformat() if run.completed_at else None,
            },
        }

    async def start(self, request: dict[str, Any]) -> dict[str, Any]:
        session_id = str(request.get("sessionId") or request.get("session_id") or "")
        session = self._require(session_id)
        if session.run is not None and session.run.status in {"preparing", "running"}:
            raise ConflictError("当前调试 Session 已有运行中的 Run")
        if session.run is not None and session.run.wait_task is not None:
            await asyncio.shield(session.run.wait_task)

        frozen = copy.deepcopy(request)
        mode = str(frozen.get("mode", "run-from-node"))
        entry = _entry_for_request(frozen)
        run = DebugRun(
            run_id=str(uuid.uuid4()),
            mode=mode,
            entry=entry,
            resolver=_resolver_nodes(frozen),
        )
        session.run = run
        session.status = "preparing"
        await self._append(
            session,
            "session",
            "starting",
            "preparing",
            {"mode": mode, "entry": entry},
        )
        await self.emit("debug.sessionSnapshot", self.snapshot(session_id))

        profile = dict(frozen.get("profile") or {})
        controller_profile = dict(profile.get("controller") or {})
        controller_type = str(controller_profile.get("type") or "")
        controller_options = dict(controller_profile.get("options") or {})
        resource_paths = [str(value) for value in profile.get("resourcePaths", []) if value]
        agent_profiles = [
            profile
            for value in profile.get("agents", [])
            if (profile := _json_object(value)) is not None
        ]
        pipeline = _pipeline_override(frozen, entry, mode)
        loop = asyncio.get_running_loop()

        def raw_callback(message: str, details: dict[str, Any]) -> None:
            copied = copy.deepcopy(details)
            loop.call_soon_threadsafe(session.queue.put_nowait, (run, message, copied))

        def prepare() -> tuple[Any, Any, Any, tuple[Any, ...], list[Any], bool, Any]:
            controller, resource, tasker, agents, owns_controller = (
                self.maa.create_debug_objects(
                controller_type, controller_options, resource_paths, agent_profiles
                )
            )
            from maa.context import ContextEventSink
            from maa.tasker import TaskerEventSink

            class QueueSink(TaskerEventSink):
                def on_raw_notification(
                    self, tasker: Any, msg: str, details: dict[str, Any]
                ) -> None:
                    del tasker
                    raw_callback(msg, details)

            sink = QueueSink()
            tasker_sink_id = tasker.add_sink(sink)

            class QueueContextSink(ContextEventSink):
                def on_raw_notification(
                    self, context: Any, msg: str, details: dict[str, Any]
                ) -> None:
                    del context
                    raw_callback(msg, details)

            context_sink = QueueContextSink()
            context_sink_id = tasker.add_context_sink(context_sink)
            job = tasker.post_task(entry, pipeline)
            return (
                controller,
                resource,
                tasker,
                (sink, context_sink, tasker_sink_id, context_sink_id),
                agents,
                owns_controller,
                job,
            )

        try:
            controller, resource, tasker, sink, agents, owns_controller, job = (
                await self.maa.call(prepare)
            )
        except Exception as error:
            session.status = "error"
            run.status = "failed"
            run.completed_at = datetime.now(UTC)
            await self._append(
                session,
                "session",
                "failed",
                "failed",
                {"error": str(error), "mode": mode, "entry": entry},
            )
            await self.emit("debug.sessionSnapshot", self.snapshot(session_id))
            raise

        session.controller = controller
        session.owns_controller = owns_controller
        session.resource = resource
        session.tasker = tasker
        session.sink = sink
        session.agents = agents
        run.job = job
        run.tasker = tasker
        run.status = "running"
        session.status = "running"
        await self._append(session, "task", "starting", "running", {"mode": mode, "entry": entry})
        await self.emit("debug.sessionSnapshot", self.snapshot(session_id))
        run.wait_task = asyncio.create_task(
            self._wait(session, run), name=f"debug-run-{run.run_id}"
        )
        session_snapshot = self.snapshot(session_id)
        result = {
            "sessionId": session_id,
            "runId": run.run_id,
            "mode": mode,
            "entry": entry,
            "startedAt": run.started_at.isoformat(),
            "session": session_snapshot,
        }
        await self.emit("debug.runStarted", result)
        return result

    async def stop(self, session_id: str, run_id: str | None, reason: str) -> dict[str, Any]:
        session = self._require(session_id)
        run = session.run
        if run is None or run.status not in {"preparing", "running"}:
            raise ConflictError("当前没有运行中的调试任务")
        if run_id and run.run_id != run_id:
            raise ConflictError("runId 与活动 Run 不匹配")
        session.status = "stopping"
        await self._append(session, "session", "starting", "stopping", {"reason": reason})
        if session.tasker is not None:
            await self.maa.call(lambda: session.tasker.post_stop().wait())
        await self.emit(
            "debug.runStopRequested",
            {"sessionId": session_id, "runId": run.run_id, "reason": reason},
        )
        return self.snapshot(session_id)

    async def destroy(self, session_id: str) -> dict[str, Any]:
        session = self._require(session_id)
        if session.run and session.run.status in {"preparing", "running"}:
            await self.stop(session_id, session.run.run_id, "session_destroyed")
        if session.run and session.run.wait_task:
            try:
                await asyncio.wait_for(asyncio.shield(session.run.wait_task), timeout=5)
            except TimeoutError:
                session.run.wait_task.cancel()
        session.status = "disposed"
        if session.consumer:
            session.consumer.cancel()
            await asyncio.gather(session.consumer, return_exceptions=True)
        self.artifacts.delete_session(session_id)
        self.events.delete_session(session_id)
        self._sessions.pop(session_id, None)
        result = {"sessionId": session_id, "status": "disposed"}
        await self.emit("debug.sessionDestroyed", result)
        return result

    async def list_events(
        self, session_id: str, after_seq: int = 0, limit: int = 2_000
    ) -> dict[str, Any]:
        self._require(session_id)
        events = self.events.list(session_id, after_seq=after_seq, limit=limit)
        return {
            "sessionId": session_id,
            "events": [event.model_dump(mode="json", by_alias=True) for event in events],
            "nextSeq": events[-1].seq if events else after_seq,
        }

    async def stop_active(self) -> bool:
        for session in tuple(self._sessions.values()):
            run = session.run
            if run and run.status in {"preparing", "running"}:
                await self.stop(session.session_id, run.run_id, "desktop_shortcut")
                return True
        return False

    async def close(self) -> None:
        for session_id in tuple(self._sessions):
            await self.destroy(session_id)

    async def _wait(self, session: DebugSession, run: DebugRun) -> None:
        try:
            while not await self.maa.call(lambda: bool(run.job.done)):  # noqa: ASYNC110
                await asyncio.sleep(0.05)
            succeeded = await self.maa.call(lambda: bool(run.job.succeeded))
            stopped = session.status == "stopping"
            run.status = "stopped" if stopped else ("completed" if succeeded else "failed")
            session.status = "idle" if stopped or succeeded else "error"
            phase = "completed" if stopped or succeeded else "failed"
            await self._append(
                session,
                "session",
                phase,
                run.status,
                {"entry": run.entry, "mode": run.mode},
            )
        except Exception as error:
            run.status = "failed"
            session.status = "error"
            await self._append(session, "session", "failed", "failed", {"error": str(error)})
        finally:
            run.completed_at = datetime.now(UTC)
            try:
                await self.maa.release_debug_objects(
                    session.controller,
                    session.tasker,
                    session.agents,
                    deactivate_controller=session.owns_controller,
                )
            finally:
                if session.run is run:
                    session.controller = None
                    session.owns_controller = False
                    session.resource = None
                    session.tasker = None
                    session.sink = None
                    session.agents = []
            await self.emit("debug.sessionSnapshot", self.snapshot(session.session_id))

    async def _consume(self, session: DebugSession) -> None:
        while True:
            run, message, details = await session.queue.get()
            phase = message.rsplit(".", 1)[-1].lower()
            status = {"starting": "running", "succeeded": "succeeded", "failed": "failed"}.get(
                phase, "info"
            )
            kind = _event_kind(message)
            payload = {"message": message, **details}
            node_name = details.get("name")
            if isinstance(node_name, str) and node_name:
                payload["node"] = run.resolver.get(
                    node_name, {"runtimeName": node_name, "label": node_name}
                )
            parent = await self._append(
                session,
                kind,
                phase,
                status,
                payload,
                source="maafw",
                run_id=run.run_id,
            )
            try:
                detail = await self.maa.collect_debug_detail(
                    run.tasker, message, details, session.session_id, run.run_id
                )
            except Exception as error:
                await self._append(
                    session,
                    "diagnostic",
                    phase,
                    "detail-failed",
                    {"message": "读取 MaaFW 详情失败", "error": str(error)},
                    run_id=run.run_id,
                    parent_seq=parent.seq,
                )
                continue
            if detail is not None:
                refs = [
                    ArtifactRef.model_validate(value)
                    for value in cast(list[dict[str, Any]], detail["artifactRefs"])
                ]
                await self._append(
                    session,
                    str(detail["kind"]),
                    phase,
                    "detail-ready",
                    cast(dict[str, Any], detail["payload"]),
                    run_id=run.run_id,
                    artifact_refs=refs,
                    parent_seq=parent.seq,
                )

    async def _append(
        self,
        session: DebugSession,
        kind: str,
        phase: str,
        status: str,
        payload: dict[str, Any],
        *,
        source: Literal["maafw", "localbridge", "mpe"] = "localbridge",
        run_id: str | None = None,
        artifact_refs: list[ArtifactRef] | None = None,
        parent_seq: int | None = None,
    ) -> DebugEvent:
        event = self.events.append(
            DebugEvent(
                session_id=session.session_id,
                run_id=(
                    run_id
                    if run_id is not None
                    else (session.run.run_id if session.run else None)
                ),
                source=source,
                kind=kind,
                phase=phase,
                status=status,
                payload=payload,
                artifact_refs=artifact_refs or [],
                parent_seq=parent_seq,
            )
        )
        session.updated_at = datetime.now(UTC)
        await self.emit("debug.event", event.model_dump(mode="json", by_alias=True))
        return event

    def _require(self, session_id: str) -> DebugSession:
        session = self._sessions.get(session_id)
        if session is None:
            raise NotFoundError("Debug Session 不存在")
        return session


def _entry_for_request(request: dict[str, Any]) -> str:
    target = _json_object(request.get("target"))
    if target is not None and target.get("runtimeName"):
        return str(target["runtimeName"])
    profile = _json_object(request.get("profile"))
    if profile is not None:
        profile_entry = _json_object(profile.get("entry"))
        if profile_entry is not None and profile_entry.get("runtimeName"):
            return str(profile_entry["runtimeName"])
    raise InvalidArgumentError("调试请求缺少 runtimeName")


def _pipeline_override(request: dict[str, Any], entry: str, mode: str) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    snapshot = _json_object(request.get("graphSnapshot"))
    if snapshot is not None:
        for file_value in _json_list(snapshot.get("files")):
            file = _json_object(file_value)
            pipeline = _json_object(file.get("pipeline")) if file is not None else None
            if pipeline is not None:
                merged.update(copy.deepcopy(pipeline))
    for item_value in _json_list(request.get("overrides")):
        item = _json_object(item_value)
        if item is not None:
            pipeline = _json_object(item.get("pipeline"))
            runtime_name = str(item.get("runtimeName", ""))
            if runtime_name and pipeline is not None:
                current = merged.get(runtime_name)
                if isinstance(current, dict):
                    normalized = _json_object(current)
                    assert normalized is not None
                    normalized.update(copy.deepcopy(pipeline))
                    merged[runtime_name] = normalized
                else:
                    merged[runtime_name] = copy.deepcopy(pipeline)
    node = merged.get(entry)
    if not isinstance(node, dict):
        raise InvalidArgumentError(f"调试快照中不存在入口节点: {entry}")
    if mode in {"single-node-run", "recognition-only", "action-only"}:
        node["next"] = []
        node["on_error"] = []
    if mode == "recognition-only":
        node["action"] = "DoNothing"
    elif mode == "action-only":
        node["recognition"] = "DirectHit"
    return merged


def _resolver_nodes(request: dict[str, Any]) -> dict[str, dict[str, Any]]:
    snapshot = _json_object(request.get("resolverSnapshot"))
    if snapshot is None:
        return {}
    result: dict[str, dict[str, Any]] = {}
    for value in _json_list(snapshot.get("nodes")):
        node = _json_object(value)
        if node is None:
            continue
        runtime_name = str(node.get("runtimeName", ""))
        if not runtime_name:
            continue
        result[runtime_name] = {
            "runtimeName": runtime_name,
            "fileId": node.get("fileId"),
            "nodeId": node.get("nodeId"),
            "label": node.get("displayName", runtime_name),
        }
    return result


def _event_kind(message: str) -> str:
    lowered = message.lower()
    if "recognition" in lowered:
        return "recognition"
    if "action" in lowered:
        return "action"
    if "nextlist" in lowered or "next_list" in lowered:
        return "next-list"
    if "task" in lowered:
        return "task"
    if "node" in lowered:
        return "node"
    return "notification"


def _json_object(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    mapping = cast(dict[Any, Any], value)
    return {str(key): item for key, item in mapping.items()}


def _json_list(value: Any) -> list[Any]:
    if not isinstance(value, list):
        return []
    return list(cast(list[Any], value))
