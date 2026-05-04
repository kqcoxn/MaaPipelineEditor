import type { DebugProtocolClient } from "../../services/protocols/DebugProtocolClient";
import { useDebugArtifactStore } from "../../stores/debugArtifactStore";
import { useDebugDiagnosticsStore } from "../../stores/debugDiagnosticsStore";
import { useDebugOverlayStore } from "../../stores/debugOverlayStore";
import { useDebugSessionStore } from "../../stores/debugSessionStore";
import { useDebugTraceStore } from "../../stores/debugTraceStore";
import type { DebugEvent, DebugPerformanceSummary } from "./types";
import {
  recognitionDetailImageRefs,
  summarizeRecognitionArtifactPayload,
} from "./artifactDetailSummary";

let registered = false;

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
    const traceStore = useDebugTraceStore.getState();
    traceStore.appendEvent(event);
    useDebugDiagnosticsStore.getState().appendFromEvent(event);
    if (isTerminalSessionEvent(event)) {
      useDebugOverlayStore.getState().clearOverlay();
    } else {
      useDebugOverlayStore.getState().applyTraceSummary(
        useDebugTraceStore.getState().summary,
      );
    }

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
    useDebugSessionStore.getState().setProtocolError(error);
    const selectedArtifactId =
      useDebugArtifactStore.getState().selectedArtifactId;
    if (selectedArtifactId) {
      useDebugArtifactStore
        .getState()
        .setError(selectedArtifactId, error.message);
    }
  });
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
