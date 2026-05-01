import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import { globalConfig } from "../../stores/configStore";
import type {
  DebugArtifactGetRequest,
  DebugArtifactPayload,
  DebugAgentTestRequest,
  DebugAgentTestResult,
  DebugCapabilityManifest,
  DebugEvent,
  DebugRunStarted,
  DebugProtocolError,
  DebugResourcePreflightRequest,
  DebugResourcePreflightResult,
  DebugRunRequest,
  DebugScreenshotCaptureRequest,
  DebugTraceReplayRequest,
  DebugTraceReplayStatus,
  DebugTraceReplayStopRequest,
  DebugTraceSnapshot,
  DebugTraceSnapshotRequest,
  DebugRunStopRequested,
  DebugRunStopRequest,
  DebugSessionSnapshot,
} from "../../features/debug/types";

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
  private readonly resourcePreflightListeners = new Set<
    Listener<DebugResourcePreflightResult>
  >();
  private readonly runStopRequestedListeners = new Set<
    Listener<DebugRunStopRequested>
  >();
  private readonly artifactListeners = new Set<Listener<DebugArtifactPayload>>();
  private readonly agentTestListeners = new Set<
    Listener<DebugAgentTestResult>
  >();
  private readonly traceSnapshotListeners = new Set<
    Listener<DebugTraceSnapshot>
  >();
  private readonly traceReplayStatusListeners = new Set<
    Listener<DebugTraceReplayStatus>
  >();
  private readonly errorListeners = new Set<Listener<DebugProtocolError>>();

  getName(): string {
    return "DebugProtocolClient";
  }

  getVersion(): string {
    return globalConfig.protocolVersion;
  }

  isConnected(): boolean {
    return this.wsClient?.isConnected() ?? false;
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
    this.wsClient.registerRoute("/lte/debug/resource_preflight", (data) =>
      this.handleResourcePreflight(data),
    );
    this.wsClient.registerRoute("/lte/debug/run_stop_requested", (data) =>
      this.handleRunStopRequested(data),
    );
    this.wsClient.registerRoute("/lte/debug/artifact", (data) =>
      this.handleArtifact(data),
    );
    this.wsClient.registerRoute("/lte/debug/agent_tested", (data) =>
      this.handleAgentTested(data),
    );
    this.wsClient.registerRoute("/lte/debug/trace_snapshot", (data) =>
      this.handleTraceSnapshot(data),
    );
    this.wsClient.registerRoute("/lte/debug/trace_replay_status", (data) =>
      this.handleTraceReplayStatus(data),
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

  preflightResources(request: DebugResourcePreflightRequest): boolean {
    return this.send("/mpe/debug/resource/preflight", request);
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

  testAgent(request: DebugAgentTestRequest): boolean {
    return this.send("/mpe/debug/agent/test", request);
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

  onResourcePreflight(
    listener: Listener<DebugResourcePreflightResult>,
  ): () => void {
    this.resourcePreflightListeners.add(listener);
    return () => this.resourcePreflightListeners.delete(listener);
  }

  onRunStopRequested(listener: Listener<DebugRunStopRequested>): () => void {
    this.runStopRequestedListeners.add(listener);
    return () => this.runStopRequestedListeners.delete(listener);
  }

  onArtifact(listener: Listener<DebugArtifactPayload>): () => void {
    this.artifactListeners.add(listener);
    return () => this.artifactListeners.delete(listener);
  }

  onAgentTested(
    listener: Listener<DebugAgentTestResult>,
  ): () => void {
    this.agentTestListeners.add(listener);
    return () => this.agentTestListeners.delete(listener);
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

  private handleResourcePreflight(data: unknown): void {
    const result = data as DebugResourcePreflightResult;
    this.resourcePreflightListeners.forEach((listener) => listener(result));
  }

  private handleRunStopRequested(data: unknown): void {
    const event = data as DebugRunStopRequested;
    this.runStopRequestedListeners.forEach((listener) => listener(event));
  }

  private handleArtifact(data: unknown): void {
    const artifact = data as DebugArtifactPayload;
    this.artifactListeners.forEach((listener) => listener(artifact));
  }

  private handleAgentTested(data: unknown): void {
    const result = data as DebugAgentTestResult;
    this.agentTestListeners.forEach((listener) => listener(result));
  }

  private handleTraceSnapshot(data: unknown): void {
    const snapshot = data as DebugTraceSnapshot;
    this.traceSnapshotListeners.forEach((listener) => listener(snapshot));
  }

  private handleTraceReplayStatus(data: unknown): void {
    const status = data as DebugTraceReplayStatus;
    this.traceReplayStatusListeners.forEach((listener) => listener(status));
  }

  private handleError(data: unknown): void {
    const error = data as DebugProtocolError;
    this.errorListeners.forEach((listener) => listener(error));
  }
}
