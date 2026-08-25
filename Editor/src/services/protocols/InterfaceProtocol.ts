import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import type {
  ProjectInterfaceAgentStatus,
  ProjectInterfaceRuntimePlan,
  ProjectInterfaceSnapshot,
  ProjectInterfaceStatus,
} from "@/features/project-interface/types";

type Listener<T> = (data: T) => void;

export class InterfaceProtocol extends BaseProtocol {
  private statusListeners = new Set<Listener<ProjectInterfaceStatus>>();
  private snapshotListeners = new Set<Listener<ProjectInterfaceSnapshot>>();
  private contextListeners = new Set<Listener<ProjectInterfaceRuntimePlan>>();
  private contextDisposedListeners = new Set<Listener<{ contextId: string }>>();
  private changedListeners = new Set<Listener<{ status: ProjectInterfaceStatus }>>();
  private agentListeners = new Set<Listener<ProjectInterfaceAgentStatus>>();
  private errorListeners = new Set<Listener<{ code: string; message: string }>>();

  getName(): string { return "InterfaceProtocol"; }
  getVersion(): string { return "1.1.0"; }

  register(wsClient: LocalWebSocketServer): void {
    this.wsClient = wsClient;
    wsClient.registerRoute("/lte/interface/status", (data) => this.emit(this.statusListeners, data));
    wsClient.registerRoute("/lte/interface/snapshot", (data) => this.emit(this.snapshotListeners, data));
    wsClient.registerRoute("/lte/interface/context", (data) => this.emit(this.contextListeners, data));
    wsClient.registerRoute("/lte/interface/context_disposed", (data) => this.emit(this.contextDisposedListeners, data));
    wsClient.registerRoute("/lte/interface/changed", (data) => this.emit(this.changedListeners, data));
    wsClient.registerRoute("/lte/interface/agent", (data) => this.emit(this.agentListeners, data));
    wsClient.registerRoute("/lte/interface/error", (data) => this.emit(this.errorListeners, data));
  }

  protected handleMessage(_path: string, _data: unknown): void {}

  requestStatus(): boolean { return this.send("/etl/interface/status", {}); }
  requestSnapshot(language = "zh_cn"): boolean { return this.send("/etl/interface/snapshot", { language }); }
  resolveContext(request: { revision: string; language: string; controllerName: string; resourceName: string; optionValues: Record<string, unknown>; agentEnabled?: Record<string, boolean>; agentOverrides?: Record<string, { childExec: string; childArgs?: string[] }> }): boolean {
    return this.send("/etl/interface/context/resolve", request);
  }
  disposeContext(contextId: string): boolean { return this.send("/etl/interface/context/dispose", { contextId }); }

  onStatus(listener: Listener<ProjectInterfaceStatus>) { this.statusListeners.add(listener); return () => this.statusListeners.delete(listener); }
  onSnapshot(listener: Listener<ProjectInterfaceSnapshot>) { this.snapshotListeners.add(listener); return () => this.snapshotListeners.delete(listener); }
  onContext(listener: Listener<ProjectInterfaceRuntimePlan>) { this.contextListeners.add(listener); return () => this.contextListeners.delete(listener); }
  onContextDisposed(listener: Listener<{ contextId: string }>) { this.contextDisposedListeners.add(listener); return () => this.contextDisposedListeners.delete(listener); }
  onChanged(listener: Listener<{ status: ProjectInterfaceStatus }>) { this.changedListeners.add(listener); return () => this.changedListeners.delete(listener); }
  onAgent(listener: Listener<ProjectInterfaceAgentStatus>) { this.agentListeners.add(listener); return () => this.agentListeners.delete(listener); }
  onError(listener: Listener<{ code: string; message: string }>) { this.errorListeners.add(listener); return () => this.errorListeners.delete(listener); }

  private send(path: string, data: unknown): boolean { return this.wsClient?.send(path, data) ?? false; }
  private emit<T>(listeners: Set<Listener<T>>, data: unknown): void { listeners.forEach((listener) => listener(data as T)); }
}
