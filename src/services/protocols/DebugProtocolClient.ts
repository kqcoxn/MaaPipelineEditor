import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import type {
  DebugArtifactGetRequest,
  DebugArtifactPayload,
  DebugBatchRecognitionRequest,
  DebugBatchRecognitionResult,
  DebugBatchRecognitionStopRequest,
  DebugCapabilityManifest,
  DebugEvent,
  DebugInterfaceImportRequest,
  DebugInterfaceImportResult,
  DebugRunStarted,
  DebugProtocolError,
  DebugRunRequest,
  DebugScreenshotCaptureRequest,
  DebugScreenshotStreamStartRequest,
  DebugScreenshotStreamStatus,
  DebugScreenshotStreamStopRequest,
  DebugTraceReplayRequest,
  DebugTraceReplayStatus,
  DebugTraceReplayStopRequest,
  DebugTraceSnapshot,
  DebugTraceSnapshotRequest,
  DebugRunStopRequested,
  DebugRunStopRequest,
  DebugSessionSnapshot,
} from "../../features/debug/types";
import { DEBUG_PROTOCOL_VERSION } from "../../features/debug/types";

type Listener<T> = (payload: T) => void;

export class DebugProtocolClient extends BaseProtocol {
  private readonly capabilityListeners = new Set<
    Listener<DebugCapabilityManifest>
  >();
  private readonly sessionCreatedListeners = new Set<
    Listener<DebugSessionSnapshot>
  >();
  private readonly sessionDestroyedListeners = new Set<Listener<string>>();
  private readonly sessionSnapshotListeners = new Set<
    Listener<DebugSessionSnapshot>
  >();
  private readonly debugEventListeners = new Set<Listener<DebugEvent>>();
  private readonly runStartedListeners = new Set<Listener<DebugRunStarted>>();
  private readonly runStopRequestedListeners = new Set<
    Listener<DebugRunStopRequested>
  >();
  private readonly artifactListeners = new Set<Listener<DebugArtifactPayload>>();
  private readonly interfaceImportListeners = new Set<
    Listener<DebugInterfaceImportResult>
  >();
  private readonly screenshotStreamStartedListeners = new Set<
    Listener<DebugScreenshotStreamStatus>
  >();
  private readonly screenshotStreamStoppedListeners = new Set<
    Listener<DebugScreenshotStreamStatus>
  >();
  private readonly traceSnapshotListeners = new Set<
    Listener<DebugTraceSnapshot>
  >();
  private readonly traceReplayStatusListeners = new Set<
    Listener<DebugTraceReplayStatus>
  >();
  private readonly batchRecognitionStartedListeners = new Set<
    Listener<DebugBatchRecognitionResult>
  >();
  private readonly batchRecognitionStoppedListeners = new Set<
    Listener<DebugBatchRecognitionResult>
  >();
  private readonly errorListeners = new Set<Listener<DebugProtocolError>>();

  getName(): string {
    return "DebugProtocolClient";
  }

  getVersion(): string {
    return DEBUG_PROTOCOL_VERSION;
  }

  register(wsClient: LocalWebSocketServer): void {
    this.wsClient = wsClient;
    this.wsClient.registerRoute("/lte/debug/capabilities", (data) =>
      this.handleCapabilities(data),
    );
    this.wsClient.registerRoute("/lte/debug/session_created", (data) =>
      this.handleSessionCreated(data),
    );
    this.wsClient.registerRoute("/lte/debug/session_destroyed", (data) =>
      this.handleSessionDestroyed(data),
    );
    this.wsClient.registerRoute("/lte/debug/session_snapshot", (data) =>
      this.handleSessionSnapshot(data),
    );
    this.wsClient.registerRoute("/lte/debug/event", (data) =>
      this.handleDebugEvent(data),
    );
    this.wsClient.registerRoute("/lte/debug/run_started", (data) =>
      this.handleRunStarted(data),
    );
    this.wsClient.registerRoute("/lte/debug/run_stop_requested", (data) =>
      this.handleRunStopRequested(data),
    );
    this.wsClient.registerRoute("/lte/debug/artifact", (data) =>
      this.handleArtifact(data),
    );
    this.wsClient.registerRoute("/lte/debug/interface_imported", (data) =>
      this.handleInterfaceImported(data),
    );
    this.wsClient.registerRoute("/lte/debug/screenshot_stream_started", (data) =>
      this.handleScreenshotStreamStarted(data),
    );
    this.wsClient.registerRoute("/lte/debug/screenshot_stream_stopped", (data) =>
      this.handleScreenshotStreamStopped(data),
    );
    this.wsClient.registerRoute("/lte/debug/trace_snapshot", (data) =>
      this.handleTraceSnapshot(data),
    );
    this.wsClient.registerRoute("/lte/debug/trace_replay_status", (data) =>
      this.handleTraceReplayStatus(data),
    );
    this.wsClient.registerRoute("/lte/debug/batch_recognition_started", (data) =>
      this.handleBatchRecognitionStarted(data),
    );
    this.wsClient.registerRoute("/lte/debug/batch_recognition_stopped", (data) =>
      this.handleBatchRecognitionStopped(data),
    );
    this.wsClient.registerRoute("/lte/debug/error", (data) =>
      this.handleError(data),
    );
  }

  protected handleMessage(path: string, data: unknown): void {
    void path;
    void data;
  }

  requestCapabilities(): boolean {
    return this.send("/mpe/debug/capabilities", {});
  }

  createSession(payload: unknown = {}): boolean {
    return this.send("/mpe/debug/session/create", payload);
  }

  destroySession(sessionId: string): boolean {
    return this.send("/mpe/debug/session/destroy", { sessionId });
  }

  requestSessionSnapshot(sessionId: string): boolean {
    return this.send("/mpe/debug/session/snapshot", {
      sessionId,
    });
  }

  startRun(request: DebugRunRequest): boolean {
    return this.send("/mpe/debug/run/start", request);
  }

  stopRun(request: DebugRunStopRequest): boolean {
    return this.send("/mpe/debug/run/stop", request);
  }

  requestArtifact(request: DebugArtifactGetRequest): boolean {
    return this.send("/mpe/debug/artifact/get", request);
  }

  captureScreenshot(request: DebugScreenshotCaptureRequest): boolean {
    return this.send("/mpe/debug/screenshot/capture", request);
  }

  startScreenshotStream(request: DebugScreenshotStreamStartRequest): boolean {
    return this.send("/mpe/debug/screenshot/start", request);
  }

  stopScreenshotStream(request: DebugScreenshotStreamStopRequest): boolean {
    return this.send("/mpe/debug/screenshot/stop", request);
  }

  importInterface(request: DebugInterfaceImportRequest): boolean {
    return this.send("/mpe/debug/interface/import", request);
  }

  requestTraceSnapshot(request: DebugTraceSnapshotRequest): boolean {
    return this.send("/mpe/debug/trace/snapshot", request);
  }

  startTraceReplay(request: DebugTraceReplayRequest): boolean {
    return this.send("/mpe/debug/trace/replay/start", request);
  }

  seekTraceReplay(request: DebugTraceReplayRequest): boolean {
    return this.send("/mpe/debug/trace/replay/seek", request);
  }

  stopTraceReplay(request: DebugTraceReplayStopRequest): boolean {
    return this.send("/mpe/debug/trace/replay/stop", request);
  }

  startBatchRecognition(request: DebugBatchRecognitionRequest): boolean {
    return this.send("/mpe/debug/batch-recognition/start", request);
  }

  stopBatchRecognition(request: DebugBatchRecognitionStopRequest): boolean {
    return this.send("/mpe/debug/batch-recognition/stop", request);
  }

  onCapabilities(listener: Listener<DebugCapabilityManifest>): () => void {
    this.capabilityListeners.add(listener);
    return () => this.capabilityListeners.delete(listener);
  }

  onSessionCreated(listener: Listener<DebugSessionSnapshot>): () => void {
    this.sessionCreatedListeners.add(listener);
    return () => this.sessionCreatedListeners.delete(listener);
  }

  onSessionDestroyed(listener: Listener<string>): () => void {
    this.sessionDestroyedListeners.add(listener);
    return () => this.sessionDestroyedListeners.delete(listener);
  }

  onSessionSnapshot(listener: Listener<DebugSessionSnapshot>): () => void {
    this.sessionSnapshotListeners.add(listener);
    return () => this.sessionSnapshotListeners.delete(listener);
  }

  onDebugEvent(listener: Listener<DebugEvent>): () => void {
    this.debugEventListeners.add(listener);
    return () => this.debugEventListeners.delete(listener);
  }

  onRunStarted(listener: Listener<DebugRunStarted>): () => void {
    this.runStartedListeners.add(listener);
    return () => this.runStartedListeners.delete(listener);
  }

  onRunStopRequested(listener: Listener<DebugRunStopRequested>): () => void {
    this.runStopRequestedListeners.add(listener);
    return () => this.runStopRequestedListeners.delete(listener);
  }

  onArtifact(listener: Listener<DebugArtifactPayload>): () => void {
    this.artifactListeners.add(listener);
    return () => this.artifactListeners.delete(listener);
  }

  onInterfaceImported(
    listener: Listener<DebugInterfaceImportResult>,
  ): () => void {
    this.interfaceImportListeners.add(listener);
    return () => this.interfaceImportListeners.delete(listener);
  }

  onScreenshotStreamStarted(
    listener: Listener<DebugScreenshotStreamStatus>,
  ): () => void {
    this.screenshotStreamStartedListeners.add(listener);
    return () => this.screenshotStreamStartedListeners.delete(listener);
  }

  onScreenshotStreamStopped(
    listener: Listener<DebugScreenshotStreamStatus>,
  ): () => void {
    this.screenshotStreamStoppedListeners.add(listener);
    return () => this.screenshotStreamStoppedListeners.delete(listener);
  }

  onTraceSnapshot(listener: Listener<DebugTraceSnapshot>): () => void {
    this.traceSnapshotListeners.add(listener);
    return () => this.traceSnapshotListeners.delete(listener);
  }

  onTraceReplayStatus(
    listener: Listener<DebugTraceReplayStatus>,
  ): () => void {
    this.traceReplayStatusListeners.add(listener);
    return () => this.traceReplayStatusListeners.delete(listener);
  }

  onBatchRecognitionStarted(
    listener: Listener<DebugBatchRecognitionResult>,
  ): () => void {
    this.batchRecognitionStartedListeners.add(listener);
    return () => this.batchRecognitionStartedListeners.delete(listener);
  }

  onBatchRecognitionStopped(
    listener: Listener<DebugBatchRecognitionResult>,
  ): () => void {
    this.batchRecognitionStoppedListeners.add(listener);
    return () => this.batchRecognitionStoppedListeners.delete(listener);
  }

  onError(listener: Listener<DebugProtocolError>): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  private send(path: string, payload: unknown): boolean {
    if (!this.wsClient) {
      console.error("[DebugProtocolClient] WebSocket client not initialized");
      return false;
    }
    return this.wsClient.send(path, payload);
  }

  private handleCapabilities(data: unknown): void {
    const capabilities = data as DebugCapabilityManifest;
    this.capabilityListeners.forEach((listener) => listener(capabilities));
  }

  private handleSessionCreated(data: unknown): void {
    const snapshot = data as DebugSessionSnapshot;
    this.sessionCreatedListeners.forEach((listener) => listener(snapshot));
  }

  private handleSessionDestroyed(data: unknown): void {
    const { sessionId, session_id: legacySessionId } = data as {
      sessionId?: string;
      session_id?: string;
    };
    const resolvedSessionId = sessionId ?? legacySessionId;
    if (!resolvedSessionId) return;
    this.sessionDestroyedListeners.forEach((listener) =>
      listener(resolvedSessionId),
    );
  }

  private handleSessionSnapshot(data: unknown): void {
    const snapshot = data as DebugSessionSnapshot;
    this.sessionSnapshotListeners.forEach((listener) => listener(snapshot));
  }

  private handleDebugEvent(data: unknown): void {
    const event = data as DebugEvent;
    this.debugEventListeners.forEach((listener) => listener(event));
  }

  private handleRunStarted(data: unknown): void {
    const event = data as DebugRunStarted;
    this.runStartedListeners.forEach((listener) => listener(event));
  }

  private handleRunStopRequested(data: unknown): void {
    const event = data as DebugRunStopRequested;
    this.runStopRequestedListeners.forEach((listener) => listener(event));
  }

  private handleArtifact(data: unknown): void {
    const artifact = data as DebugArtifactPayload;
    this.artifactListeners.forEach((listener) => listener(artifact));
  }

  private handleInterfaceImported(data: unknown): void {
    const result = data as DebugInterfaceImportResult;
    this.interfaceImportListeners.forEach((listener) => listener(result));
  }

  private handleScreenshotStreamStarted(data: unknown): void {
    const status = data as DebugScreenshotStreamStatus;
    this.screenshotStreamStartedListeners.forEach((listener) =>
      listener(status),
    );
  }

  private handleScreenshotStreamStopped(data: unknown): void {
    const status = data as DebugScreenshotStreamStatus;
    this.screenshotStreamStoppedListeners.forEach((listener) =>
      listener(status),
    );
  }

  private handleTraceSnapshot(data: unknown): void {
    const snapshot = data as DebugTraceSnapshot;
    this.traceSnapshotListeners.forEach((listener) => listener(snapshot));
  }

  private handleTraceReplayStatus(data: unknown): void {
    const status = data as DebugTraceReplayStatus;
    this.traceReplayStatusListeners.forEach((listener) => listener(status));
  }

  private handleBatchRecognitionStarted(data: unknown): void {
    const result = data as DebugBatchRecognitionResult;
    this.batchRecognitionStartedListeners.forEach((listener) =>
      listener(result),
    );
  }

  private handleBatchRecognitionStopped(data: unknown): void {
    const result = data as DebugBatchRecognitionResult;
    this.batchRecognitionStoppedListeners.forEach((listener) =>
      listener(result),
    );
  }

  private handleError(data: unknown): void {
    const error = data as DebugProtocolError;
    this.errorListeners.forEach((listener) => listener(error));
  }
}
