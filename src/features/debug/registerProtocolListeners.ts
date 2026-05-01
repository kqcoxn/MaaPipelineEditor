import type { DebugProtocolClient } from "../../services/protocols/DebugProtocolClient";
import { useDebugArtifactStore } from "../../stores/debugArtifactStore";
import { useDebugDiagnosticsStore } from "../../stores/debugDiagnosticsStore";
import { useDebugOverlayStore } from "../../stores/debugOverlayStore";
import { useDebugSessionStore } from "../../stores/debugSessionStore";
import { useDebugTraceStore } from "../../stores/debugTraceStore";
import type {
  DebugBatchRecognitionResult,
  DebugPerformanceSummary,
} from "./types";
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

  debugProtocolClient.onRunStopRequested((request) => {
    useDebugSessionStore.getState().setRunStopRequested(request);
  });

  debugProtocolClient.onDebugEvent((event) => {
    const traceStore = useDebugTraceStore.getState();
    traceStore.appendEvent(event);
    useDebugSessionStore.getState().updateScreenshotStreamFrame(event);
    useDebugDiagnosticsStore.getState().appendFromEvent(event);
    useDebugOverlayStore.getState().applyTraceSummary(
      useDebugTraceStore.getState().summary,
    );

    if (event.detailRef) {
      useDebugArtifactStore.getState().upsertRef({
        id: event.detailRef,
        sessionId: event.sessionId,
        type: `${event.kind}/detail`,
        mime: "application/json",
        createdAt: event.timestamp,
        eventSeq: event.seq,
      });
      if (
        event.data?.performanceSummaryRef === event.detailRef ||
        event.data?.mode === "batch-recognition"
      ) {
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
      if (event.data?.source !== "live") {
        useDebugArtifactStore.getState().selectArtifact(event.screenshotRef);
      }
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
    if (
      payload.ref.type === "batch-recognition-summary" &&
      isBatchRecognitionResult(payload.data)
    ) {
      useDebugTraceStore
        .getState()
        .setPerformanceSummary(batchResultToPerformanceSummary(payload.data));
    }
  });

  debugProtocolClient.onAgentTested((result) => {
    useDebugSessionStore.getState().setAgentTestResult(result);
  });

  debugProtocolClient.onScreenshotStreamStarted((status) => {
    useDebugSessionStore.getState().setScreenshotStreamStatus(status);
  });

  debugProtocolClient.onScreenshotStreamStopped((status) => {
    useDebugSessionStore.getState().setScreenshotStreamStatus(status);
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

  debugProtocolClient.onBatchRecognitionStarted((result) => {
    useDebugTraceStore
      .getState()
      .setPerformanceSummary(batchResultToPerformanceSummary(result));
  });

  debugProtocolClient.onBatchRecognitionStopped((result) => {
    useDebugTraceStore
      .getState()
      .setPerformanceSummary(batchResultToPerformanceSummary(result));
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

function isBatchRecognitionResult(
  value: unknown,
): value is DebugBatchRecognitionResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "batchId" in value &&
    "results" in value &&
    "target" in value
  );
}

function batchResultToPerformanceSummary(
  result: DebugBatchRecognitionResult,
): DebugPerformanceSummary {
  return {
    sessionId: result.sessionId,
    runId: result.batchId,
    mode: "batch-recognition",
    entry: result.target.runtimeName,
    status: result.status,
    eventCount: result.completed,
    nodeCount: 1,
    recognitionCount: result.completed,
    actionCount: 0,
    diagnosticCount: result.failed,
    artifactRefCount: result.results.reduce(
      (total, item) =>
        total +
        (item.detailRefs?.length ?? 0) +
        (item.screenshotRefs?.length ?? 0),
      0,
    ),
    screenshotRefCount: result.results.reduce(
      (total, item) => total + (item.screenshotRefs?.length ?? 0),
      0,
    ),
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    durationMs: result.results.reduce(
      (total, item) => total + (item.durationMs ?? 0),
      0,
    ),
    nodes: [
      {
        fileId: result.target.fileId,
        nodeId: result.target.nodeId,
        runtimeName: result.target.runtimeName,
        status: result.status,
        firstSeq: 0,
        lastSeq: 0,
        durationMs: result.averageDurationMs,
        recognitionCount: result.completed,
        actionCount: 0,
        nextListCount: 0,
        waitFreezesCount: 0,
        detailRefCount: result.results.reduce(
          (total, item) => total + (item.detailRefs?.length ?? 0),
          0,
        ),
        screenshotRefCount: result.results.reduce(
          (total, item) => total + (item.screenshotRefs?.length ?? 0),
          0,
        ),
      },
    ],
    slowNodes: [],
    generatedAt: result.completedAt ?? result.startedAt,
  };
}
