import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import type {
  DebugCapabilityManifest,
  DebugProtocolError,
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
  private readonly errorListeners = new Set<Listener<DebugProtocolError>>();

  getName(): string {
    return "DebugProtocolClient";
  }

  getVersion(): string {
    return "0.9.0";
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
    return this.send("/mpe/debug/session/destroy", { session_id: sessionId });
  }

  requestSessionSnapshot(sessionId: string): boolean {
    return this.send("/mpe/debug/session/snapshot", {
      session_id: sessionId,
    });
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
    const { session_id: sessionId } = data as { session_id?: string };
    if (!sessionId) return;
    this.sessionDestroyedListeners.forEach((listener) => listener(sessionId));
  }

  private handleSessionSnapshot(data: unknown): void {
    const snapshot = data as DebugSessionSnapshot;
    this.sessionSnapshotListeners.forEach((listener) => listener(snapshot));
  }

  private handleError(data: unknown): void {
    const error = data as DebugProtocolError;
    this.errorListeners.forEach((listener) => listener(error));
  }
}
