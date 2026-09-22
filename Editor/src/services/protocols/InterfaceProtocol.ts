import type { PiReply, PiRequest, PiProject } from "@/features/pi-editor/types";
import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import type {
  ProjectInterfaceAgentStatus,
  ProjectInterfaceContextRequest,
  ProjectInterfaceRuntimePlan,
  ProjectInterfaceSnapshot,
  ProjectInterfaceStatus,
} from "@/features/project-interface/types";

type Listener<T> = (data: T) => void;

export class InterfaceProtocol extends BaseProtocol {
  private editorRequests = new Map<string, { resolve: (value: PiProject) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private statusListeners = new Set<Listener<ProjectInterfaceStatus>>();
  private snapshotListeners = new Set<Listener<{ requestId: string; snapshot: ProjectInterfaceSnapshot }>>();
  private contextListeners = new Set<Listener<ProjectInterfaceRuntimePlan>>();
  private contextDisposedListeners = new Set<Listener<{ contextId: string }>>();
  private changedListeners = new Set<Listener<{ status: ProjectInterfaceStatus }>>();
  private agentListeners = new Set<Listener<ProjectInterfaceAgentStatus>>();
  private errorListeners = new Set<Listener<{ code: string; message: string; requestId?: string }>>();

  getName(): string { return "InterfaceProtocol"; }
  getVersion(): string { return "2.0.0"; }

  register(wsClient: LocalWebSocketServer): void {
    this.wsClient = wsClient;
    wsClient.registerRoute("/lte/interface/editor/result", (data: PiReply) => {
      const pending = this.editorRequests.get(data.requestId);
      if (!pending) return;
      clearTimeout(pending.timer); this.editorRequests.delete(data.requestId);
      if (data.error || !data.project) pending.reject(Object.assign(new Error(data.error ?? "PI 响应无效"), { code: data.code, path: data.path }));
      else pending.resolve(data.project);
    });
    wsClient.registerRoute("/lte/interface/status", (data) => this.emit(this.statusListeners, data));
    wsClient.registerRoute("/lte/interface/snapshot", (data) => this.emit(this.snapshotListeners, data));
    wsClient.registerRoute("/lte/interface/context", (data) => this.emit(this.contextListeners, data));
    wsClient.registerRoute("/lte/interface/context_disposed", (data) => this.emit(this.contextDisposedListeners, data));
    wsClient.registerRoute("/lte/interface/changed", (data) => this.emit(this.changedListeners, data));
    wsClient.registerRoute("/lte/interface/agent", (data) => this.emit(this.agentListeners, data));
    wsClient.registerRoute("/lte/interface/error", (data) => this.emit(this.errorListeners, data));
  }

  protected handleMessage(_path: string, _data: unknown): void {}

  requestEditor(action: "read" | "validate" | "save", request: PiRequest = {}): Promise<PiProject> {
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.editorRequests.delete(requestId); reject(new Error("PI 请求超时，请刷新核对磁盘状态")); }, 30000);
      this.editorRequests.set(requestId, { resolve, reject, timer });
      if (!this.send(`/etl/interface/editor/${action}`, { ...request, requestId })) {
        clearTimeout(timer); this.editorRequests.delete(requestId); reject(new Error("请先连接 LocalBridge"));
      }
    });
  }

  requestStatus(): boolean { return this.send("/etl/interface/status", {}); }
  requestSnapshot(language = "zh_cn", requestId: string = crypto.randomUUID()): boolean { return this.send("/etl/interface/snapshot", { language, requestId }); }
  resolveContext(request: ProjectInterfaceContextRequest): boolean {
    return this.send("/etl/interface/context/resolve", request);
  }
  disposeContext(contextId: string): boolean { return this.send("/etl/interface/context/dispose", { contextId }); }

  onStatus(listener: Listener<ProjectInterfaceStatus>) { this.statusListeners.add(listener); return () => this.statusListeners.delete(listener); }
  onSnapshot(listener: Listener<{ requestId: string; snapshot: ProjectInterfaceSnapshot }>) { this.snapshotListeners.add(listener); return () => this.snapshotListeners.delete(listener); }
  onContext(listener: Listener<ProjectInterfaceRuntimePlan>) { this.contextListeners.add(listener); return () => this.contextListeners.delete(listener); }
  onContextDisposed(listener: Listener<{ contextId: string }>) { this.contextDisposedListeners.add(listener); return () => this.contextDisposedListeners.delete(listener); }
  onChanged(listener: Listener<{ status: ProjectInterfaceStatus }>) { this.changedListeners.add(listener); return () => this.changedListeners.delete(listener); }
  onAgent(listener: Listener<ProjectInterfaceAgentStatus>) { this.agentListeners.add(listener); return () => this.agentListeners.delete(listener); }
  onError(listener: Listener<{ code: string; message: string; requestId?: string }>) { this.errorListeners.add(listener); return () => this.errorListeners.delete(listener); }

  private send(path: string, data: unknown): boolean { return this.wsClient?.send(path, data) ?? false; }
  private emit<T>(listeners: Set<Listener<T>>, data: unknown): void { listeners.forEach((listener) => listener(data as T)); }
}
