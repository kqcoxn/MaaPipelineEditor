import type { DebugProtocolClient } from "../../../services/protocols/DebugProtocolClient";
import { message } from "antd";
import { useDebugArtifactStore } from "@/stores/debug/debugArtifactStore";
import { useDebugDiagnosticsStore } from "@/stores/debug/debugDiagnosticsStore";
import { useDebugOverlayStore } from "@/stores/debug/debugOverlayStore";
import { useDebugSessionStore } from "@/stores/debug/debugSessionStore";
import { useDebugTraceStore } from "@/stores/debug/debugTraceStore";
import type { DebugEvent, DebugPerformanceSummary } from "../types";
import {
  recognitionDetailImageRefs,
  summarizeRecognitionArtifactPayload,
} from "../utils/artifactDetailSummary";

let registered = false;
let pendingDebugEvents: DebugEvent[] = [];
let debugEventFlushTimer: ReturnType<typeof setTimeout> | undefined;

function enqueueDebugEvent(
  debugProtocolClient: DebugProtocolClient,
  event: DebugEvent,
): void {
  pendingDebugEvents.push(event);
  if (debugEventFlushTimer !== undefined) return;
  debugEventFlushTimer = setTimeout(
    () => flushDebugEvents(debugProtocolClient),
    16,
  );
}

function flushDebugEvents(debugProtocolClient: DebugProtocolClient): void {
  if (debugEventFlushTimer !== undefined) {
    clearTimeout(debugEventFlushTimer);
  }
  debugEventFlushTimer = undefined;
  if (pendingDebugEvents.length === 0) return;
  const events = pendingDebugEvents;
  pendingDebugEvents = [];
  useDebugTraceStore.getState().appendEvents(events);

  for (const event of events) {
    applyDebugEventSideEffects(debugProtocolClient, event);
  }
  const lastEvent = events[events.length - 1];
  if (isTerminalSessionEvent(lastEvent)) {
    useDebugOverlayStore.getState().clearOverlay();
  } else {
    useDebugOverlayStore.getState().applyTraceSummary(
      useDebugTraceStore.getState().summary,
    );
  }
}

export function registerDebugProtocolListeners(
  debugProtocolClient: DebugProtocolClient,
): void {
  if (registered) return;
  registered = true;

  debugProtocolClient.onCapabilities((manifest) => {
    useDebugSessionStore.getState().setCapabilities(manifest);
  });

  debugProtocolClient.onSessionCreated((snapshot) => {
    useDebugSessionStore.getState().setSessionSnapshot(snapshot);
  });

  debugProtocolClient.onSessionDestroyed((sessionId) => {
    flushDebugEvents(debugProtocolClient);
    useDebugSessionStore.getState().clearSession(sessionId);
    useDebugTraceStore.getState().resetTrace(sessionId);
    useDebugArtifactStore.getState().resetArtifacts(sessionId);
    useDebugOverlayStore.getState().clearOverlay();
  });

  debugProtocolClient.onSessionSnapshot((snapshot) => {
    useDebugSessionStore.getState().setSessionSnapshot(snapshot);
  });

  debugProtocolClient.onRunStarted((run) => {
    useDebugSessionStore.getState().setRunStarted(run);
  });

  debugProtocolClient.onResourcePreflight((result) => {
    useDebugSessionStore.getState().setResourcePreflightResult(result);
    useDebugDiagnosticsStore
      .getState()
      .setPreflightDiagnostics(result.diagnostics ?? []);
  });

  debugProtocolClient.onResourceHealth((result) => {
    useDebugSessionStore.getState().setResourceHealthResult(result);
  });

  debugProtocolClient.onRunStopRequested((request) => {
    useDebugSessionStore.getState().setRunStopRequested(request);
  });

  debugProtocolClient.onDebugEvent((event) => {
    enqueueDebugEvent(debugProtocolClient, event);
  });

  debugProtocolClient.onArtifact((payload) => {
    useDebugArtifactStore.getState().setPayload(payload);
    if (payload.ref.type === "recognition-detail") {
      const summary = summarizeRecognitionArtifactPayload(payload);
      for (const imageRef of recognitionDetailImageRefs(summary)) {
        useDebugArtifactStore.getState().upsertRef({
          id: imageRef.ref,
          sessionId: payload.ref.sessionId,
          type: recognitionImageArtifactType(imageRef.kind),
          mime: "image/png",
          createdAt: payload.ref.createdAt,
          eventSeq: payload.ref.eventSeq,
        });
      }
    }
    if (
      payload.ref.type === "performance-summary" &&
      isPerformanceSummary(payload.data)
    ) {
      useDebugTraceStore.getState().setPerformanceSummary(payload.data);
    }
  });

  debugProtocolClient.onAgentTested((result) => {
    useDebugSessionStore.getState().setAgentTestResult(result);
  });

  debugProtocolClient.onTraceSnapshot((snapshot) => {
    flushDebugEvents(debugProtocolClient);
    useDebugTraceStore
      .getState()
      .applyTraceSnapshot(snapshot.events, snapshot.sessionId, snapshot.runId);
    useDebugOverlayStore.getState().applyTraceSummary(
      useDebugTraceStore.getState().summary,
    );
  });

  debugProtocolClient.onTraceReplayStatus((status) => {
    useDebugTraceStore.getState().setTraceReplayStatus(status);
    useDebugOverlayStore.getState().applyReplaySummary(
      useDebugTraceStore.getState().summary,
    );
  });

  debugProtocolClient.onError((error) => {
    const sessionStore = useDebugSessionStore.getState();
    sessionStore.setProtocolError(error);
    if (error.code === "debug_pi_agent_start_failed" || error.code === "debug_run_start_failed" || error.code.includes("pi_agent")) {
      message.error(error.message || "Project Interface Agent 启动失败，请检查启动指令和工作目录");
    }
    const detail = asRecord(error.detail);
    const detailAgentId = typeof detail.agentId === "string" ? detail.agentId.trim() : "";
    const detailAgentIds = Array.isArray(detail.agentIds)
      ? detail.agentIds.filter((value): value is string => typeof value === "string" && value.trim() !== "")
      : [];
    const agentIds = detailAgentId ? [detailAgentId] : detailAgentIds;
    if (agentIds.length === 0 && error.code.includes("agent")) {
      const knownAgents = Object.keys(sessionStore.agentTestResults);
      if (knownAgents.length === 1) agentIds.push(knownAgents[0]);
    }
    for (const agentId of agentIds) {
      sessionStore.setAgentTestResult({
        agentId,
        success: false,
        checkedAt: new Date().toISOString(),
        message: error.message,
        failureStage: typeof detail.failureStage === "string" ? detail.failureStage : "connect",
      });
    }
    const selectedArtifactId =
      useDebugArtifactStore.getState().selectedArtifactId;
    if (selectedArtifactId) {
      useDebugArtifactStore
        .getState()
        .setError(selectedArtifactId, error.message);
    }
  });
}

/**
 * LocalBridge 重启后，旧进程内的调试会话、trace 和产物都不可再访问。
 * 一并清理旧 trace，避免用户继续对已失效的 sessionId 发起回放或产物请求。
 */
export function resetDebugProtocolStateForConnectionLoss(): void {
  if (debugEventFlushTimer !== undefined) {
    clearTimeout(debugEventFlushTimer);
    debugEventFlushTimer = undefined;
  }
  pendingDebugEvents = [];
  useDebugSessionStore.getState().resetForConnectionLoss();
  useDebugArtifactStore.getState().resetArtifacts();
  useDebugDiagnosticsStore.getState().clearDiagnostics();
  useDebugTraceStore.getState().resetTrace();
  useDebugOverlayStore.getState().clearOverlay();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function applyDebugEventSideEffects(
  debugProtocolClient: DebugProtocolClient,
  event: DebugEvent,
): void {
  useDebugDiagnosticsStore.getState().appendFromEvent(event);

  if (event.detailRef) {
    useDebugArtifactStore.getState().upsertRef({
      id: event.detailRef,
      sessionId: event.sessionId,
      type: `${event.kind}/detail`,
      mime: "application/json",
      createdAt: event.timestamp,
      eventSeq: event.seq,
    });
    if (event.data?.performanceSummaryRef === event.detailRef) {
      useDebugArtifactStore.getState().setLoading(event.detailRef);
      debugProtocolClient.requestArtifact({
        sessionId: event.sessionId,
        artifactId: event.detailRef,
      });
    }
  }
  if (event.screenshotRef) {
    useDebugArtifactStore.getState().upsertRef({
      id: event.screenshotRef,
      sessionId: event.sessionId,
      type: `${event.kind}/screenshot`,
      mime: "image/png",
      createdAt: event.timestamp,
      eventSeq: event.seq,
    });
    useDebugArtifactStore.getState().selectArtifact(event.screenshotRef);
  }

  // 提前注册 recognition 事件中的图像 artifact refs（不依赖 detail JSON 加载）
  if (event.kind === "recognition" && event.data) {
    const rawImageRef =
      typeof event.data.rawImageRef === "string" &&
      event.data.rawImageRef.trim() !== ""
        ? event.data.rawImageRef.trim()
        : undefined;
    if (rawImageRef) {
      useDebugArtifactStore.getState().upsertRef({
        id: rawImageRef,
        sessionId: event.sessionId,
        type: "recognition-raw-image",
        mime: "image/png",
        createdAt: event.timestamp,
        eventSeq: event.seq,
      });
    }
    const drawImageRefs = readStringArray(event.data.drawImageRefs);
    for (const ref of drawImageRefs) {
      useDebugArtifactStore.getState().upsertRef({
        id: ref,
        sessionId: event.sessionId,
        type: "recognition-draw-image",
        mime: "image/png",
        createdAt: event.timestamp,
        eventSeq: event.seq,
      });
    }
  }
}

function isTerminalSessionEvent(event: DebugEvent): boolean {
  if (event.kind !== "session") return false;
  return (
    event.phase === "completed" ||
    event.phase === "failed" ||
    event.status === "completed" ||
    event.status === "failed" ||
    event.status === "stopped"
  );
}

function recognitionImageArtifactType(
  kind: ReturnType<typeof recognitionDetailImageRefs>[number]["kind"],
): string {
  switch (kind) {
    case "raw":
      return "recognition-raw-image";
    case "draw":
      return "recognition-draw-image";
    case "screenshot":
      return "recognition-screenshot-image";
  }
}

function isPerformanceSummary(value: unknown): value is DebugPerformanceSummary {
  return (
    typeof value === "object" &&
    value !== null &&
    "runId" in value &&
    "eventCount" in value &&
    "nodes" in value
  );
}

function readStringArray(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && item.trim() !== "",
  );
}
