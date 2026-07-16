import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import type { DebugEvent as BridgeDebugEvent } from "../generated/bridge-v2";
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
  DebugResourceHealthRequest,
  DebugResourceHealthResult,
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
  private readonly eventCache = new Map<string, DebugEvent[]>();
  private replayStatus?: DebugTraceReplayStatus;
  private replayTimer?: ReturnType<typeof setInterval>;
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
  private readonly resourceHealthListeners = new Set<
    Listener<DebugResourceHealthResult>
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
    this.wsClient.registerRoute("debug.capabilities", (data) =>
      this.handleCapabilities(data),
    );
    this.wsClient.registerRoute("debug.sessionCreated", (data) =>
      this.handleSessionCreated(data),
    );
    this.wsClient.registerRoute("debug.sessionDestroyed", (data) =>
      this.handleSessionDestroyed(data),
    );
    this.wsClient.registerRoute("debug.sessionSnapshot", (data) =>
      this.handleSessionSnapshot(data),
    );
    this.wsClient.registerRoute("debug.event", (data) =>
      this.handleDebugEvent(data),
    );
    this.wsClient.registerRoute("debug.runStarted", (data) =>
      this.handleRunStarted(data),
    );
    this.wsClient.registerRoute("debug.resourcePreflight", (data) =>
      this.handleResourcePreflight(data),
    );
    this.wsClient.registerRoute("debug.resourceHealth", (data) =>
      this.handleResourceHealth(data),
    );
    this.wsClient.registerRoute("debug.runStopRequested", (data) =>
      this.handleRunStopRequested(data),
    );
    this.wsClient.registerRoute("debug.artifact", (data) =>
      this.handleArtifact(data),
    );
    this.wsClient.registerRoute("debug.agentTested", (data) =>
      this.handleAgentTested(data),
    );
    this.wsClient.registerRoute("system.error", (data) =>
      this.handleError(data),
    );
  }

  protected handleMessage(path: string, data: unknown): void {
    void path;
    void data;
  }

  requestCapabilities(): boolean {
    return this.send("debug.capabilities", {});
  }

  createSession(payload: unknown = {}): boolean {
    return this.send("debug.session.create", payload);
  }

  destroySession(sessionId: string): boolean {
    return this.send("debug.session.destroy", { sessionId });
  }

  requestSessionSnapshot(sessionId: string): boolean {
    return this.send("debug.session.snapshot", {
      sessionId,
    });
  }

  startRun(request: DebugRunRequest): boolean {
    return this.send("debug.run.start", request);
  }

  preflightResources(request: DebugResourcePreflightRequest): boolean {
    return this.send("debug.resource.preflight", request);
  }

  checkResourceHealth(request: DebugResourceHealthRequest): boolean {
    return this.send("debug.resource.health", request);
  }

  stopRun(request: DebugRunStopRequest): boolean {
    return this.send("debug.run.stop", request);
  }

  requestArtifact(request: DebugArtifactGetRequest): boolean {
    const client = this.wsClient;
    if (!client) return false;
    void (async () => {
      try {
        const { blob, headers } = await client.fetchArtifactResponse(request.artifactId);
        const mime = blob.type || "application/octet-stream";
        const type = headers.get("X-MPE-Artifact-Kind") || "debug-artifact";
        const ref = {
          id: request.artifactId,
          sessionId:
            headers.get("X-MPE-Artifact-Session-Id") || request.sessionId,
          type,
          mime,
          size: blob.size,
          createdAt:
            headers.get("X-MPE-Artifact-Created-At") || new Date().toISOString(),
        };
        if (mime.startsWith("image/")) {
          this.handleArtifact({
            ref,
            encoding: "url",
            content: client.cacheArtifactUrl(request.artifactId, blob),
          });
          return;
        }
        const content = await blob.text();
        if (mime.includes("json")) {
          this.handleArtifact({ ref, encoding: "json", data: JSON.parse(content) });
        } else {
          this.handleArtifact({ ref, encoding: "utf8", content });
        }
      } catch (error) {
        this.handleError({
          code: "artifact_fetch_failed",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  }

  captureScreenshot(request: DebugScreenshotCaptureRequest): boolean {
    return this.send("debug.screenshot.capture", request);
  }

  testAgent(request: DebugAgentTestRequest): boolean {
    return this.send("debug.agent.test", request);
  }

  requestTraceSnapshot(request: DebugTraceSnapshotRequest): boolean {
    const client = this.wsClient;
    if (!client) return false;
    void client
      .request<{ events: BridgeDebugEvent[] }>("debug.events.list", {
        sessionId: request.sessionId,
        afterSeq: 0,
        limit: 10_000,
      })
      .then((result) => {
        const events = result.events
          .map(normalizeBridgeDebugEvent)
          .filter((event) => !request.runId || event.runId === request.runId);
        this.eventCache.set(request.sessionId, events);
        this.handleTraceSnapshot({ ...request, events });
      })
      .catch((error: unknown) =>
        this.handleError({
          code: "trace_snapshot_failed",
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    return true;
  }

  startTraceReplay(request: DebugTraceReplayRequest): boolean {
    this.stopReplayTimer();
    const events = this.replayEvents(request.sessionId, request.runId);
    const now = new Date().toISOString();
    this.replayStatus = {
      sessionId: request.sessionId,
      runId: request.runId,
      active: true,
      playing: true,
      cursorSeq: request.cursorSeq ?? events[0]?.seq ?? 0,
      minSeq: events[0]?.seq,
      maxSeq: events.at(-1)?.seq,
      nodeId: request.nodeId,
      speed: request.speed ?? 1,
      startedAt: now,
      updatedAt: now,
    };
    this.handleTraceReplayStatus(this.replayStatus);
    this.replayTimer = setInterval(
      () => this.advanceReplay(),
      Math.max(40, 400 / (this.replayStatus.speed || 1)),
    );
    return true;
  }

  seekTraceReplay(request: DebugTraceReplayRequest): boolean {
    const events = this.replayEvents(request.sessionId, request.runId);
    this.replayStatus = {
      ...(this.replayStatus ?? {
        sessionId: request.sessionId,
        active: true,
        playing: false,
        cursorSeq: 0,
      }),
      runId: request.runId,
      cursorSeq: request.cursorSeq ?? events[0]?.seq ?? 0,
      minSeq: events[0]?.seq,
      maxSeq: events.at(-1)?.seq,
      nodeId: request.nodeId,
      speed: request.speed ?? this.replayStatus?.speed ?? 1,
      updatedAt: new Date().toISOString(),
    };
    this.handleTraceReplayStatus(this.replayStatus);
    return true;
  }

  stopTraceReplay(request: DebugTraceReplayStopRequest): boolean {
    this.stopReplayTimer();
    if (this.replayStatus) {
      this.replayStatus = {
        ...this.replayStatus,
        active: false,
        playing: false,
        reason: request.reason,
        stoppedAt: new Date().toISOString(),
      };
      this.handleTraceReplayStatus(this.replayStatus);
    }
    return true;
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

  onResourceHealth(
    listener: Listener<DebugResourceHealthResult>,
  ): () => void {
    this.resourceHealthListeners.add(listener);
    return () => this.resourceHealthListeners.delete(listener);
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
    const event = normalizeBridgeDebugEvent(data as BridgeDebugEvent);
    const events = this.eventCache.get(event.sessionId) ?? [];
    if (!events.some((candidate) => candidate.seq === event.seq)) {
      events.push(event);
      events.sort((left, right) => left.seq - right.seq);
      this.eventCache.set(event.sessionId, events);
    }
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

  private handleResourceHealth(data: unknown): void {
    const result = data as DebugResourceHealthResult;
    this.resourceHealthListeners.forEach((listener) => listener(result));
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

  private replayEvents(sessionId: string, runId?: string): DebugEvent[] {
    const events = this.eventCache.get(sessionId) ?? [];
    return runId ? events.filter((event) => event.runId === runId) : events;
  }

  private advanceReplay(): void {
    const status = this.replayStatus;
    if (!status?.active || !status.playing) return;
    const events = this.replayEvents(status.sessionId, status.runId);
    const next = events.find((event) => event.seq > status.cursorSeq);
    if (!next) {
      this.stopTraceReplay({ sessionId: status.sessionId, reason: "completed" });
      return;
    }
    this.replayStatus = {
      ...status,
      cursorSeq: next.seq,
      updatedAt: new Date().toISOString(),
    };
    this.handleTraceReplayStatus(this.replayStatus);
  }

  private stopReplayTimer(): void {
    if (this.replayTimer) clearInterval(this.replayTimer);
    this.replayTimer = undefined;
  }
}

function normalizeBridgeDebugEvent(event: BridgeDebugEvent): DebugEvent {
  const payload = event.payload ?? {};
  const refs = event.artifactRefs ?? [];
  const detail = refs.find((ref) => ref.mimeType.includes("json"));
  const screenshot = refs.find((ref) => ref.mimeType.startsWith("image/"));
  return {
    sessionId: event.sessionId,
    runId: event.runId ?? "",
    seq: event.seq,
    timestamp: event.timestamp,
    source: event.source,
    kind: event.kind as DebugEvent["kind"],
    maafwMessage:
      typeof payload.message === "string" ? payload.message : undefined,
    phase: event.phase as DebugEvent["phase"],
    status: event.status,
    taskId: typeof payload.taskId === "number" ? payload.taskId : undefined,
    node:
      typeof payload.node === "object" && payload.node !== null
        ? (payload.node as DebugEvent["node"])
        : undefined,
    detailRef: detail?.artifactId,
    screenshotRef: screenshot?.artifactId,
    data: payload,
  };
}
