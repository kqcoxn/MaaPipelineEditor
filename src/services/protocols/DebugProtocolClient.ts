import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import type {
  DebugArtifactGetRequest,
  DebugArtifactPayload,
  DebugCapabilityManifest,
  DebugEvent,
  DebugRunStarted,
  DebugProtocolError,
  DebugRunRequest,
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
  private readonly runStopRequestedListeners = new Set<
    Listener<DebugRunStopRequested>
  >();
  private readonly artifactListeners = new Set<Listener<DebugArtifactPayload>>();
  private readonly errorListeners = new Set<Listener<DebugProtocolError>>();

  getName(): string {
    return "DebugProtocolClient";
  }

  getVersion(): string {
    return "0.11.0";
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

  private handleError(data: unknown): void {
    const error = data as DebugProtocolError;
    this.errorListeners.forEach((listener) => listener(error));
  }
}
