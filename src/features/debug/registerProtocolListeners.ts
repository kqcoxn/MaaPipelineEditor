import type { DebugProtocolClient } from "../../services/protocols/DebugProtocolClient";
import { useDebugArtifactStore } from "../../stores/debugArtifactStore";
import { useDebugDiagnosticsStore } from "../../stores/debugDiagnosticsStore";
import { useDebugOverlayStore } from "../../stores/debugOverlayStore";
import { useDebugRunProfileStore } from "../../stores/debugRunProfileStore";
import { useDebugSessionStore } from "../../stores/debugSessionStore";
import { useDebugTraceStore } from "../../stores/debugTraceStore";

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

  debugProtocolClient.onRunStopRequested((request) => {
    useDebugSessionStore.getState().setRunStopRequested(request);
  });

  debugProtocolClient.onDebugEvent((event) => {
    const traceStore = useDebugTraceStore.getState();
    traceStore.appendEvent(event);
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
    }
  });

  debugProtocolClient.onArtifact((payload) => {
    useDebugArtifactStore.getState().setPayload(payload);
  });

  debugProtocolClient.onInterfaceImported((result) => {
    useDebugRunProfileStore.getState().applyInterfaceImport(result);
    useDebugDiagnosticsStore
      .getState()
      .setPreflightDiagnostics(result.diagnostics ?? []);
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
