import { BaseProtocol } from "./BaseProtocol";
import type { LocalWebSocketServer } from "../server";
import type { InterfaceRunRequest, InterfaceRunState } from "@/features/project-interface/interfaceRunTypes";
import type { ProjectInterfaceContextRequest } from "@/features/project-interface/types";
export type InterfaceRunEvent =
  | { type: "state"; data: InterfaceRunState }
  | { type: "prepared"; data: { requestId: string; preparation: { id: string } } }
  | { type: "error"; data: { requestId: string; message: string } };
export class InterfaceRunProtocol extends BaseProtocol {
  private listeners = new Set<(event: InterfaceRunEvent) => void>();
  getName() { return "InterfaceRunProtocol"; }
  getVersion() { return "1.0.0"; }
  protected handleMessage() {}
  register(client: LocalWebSocketServer) {
    this.wsClient = client;
    client.registerRoute("/lte/interface-run/state", data => this.emit({ type: "state", data }));
    client.registerRoute("/lte/interface-run/prepared", data => this.emit({ type: "prepared", data }));
    client.registerRoute("/lte/interface-run/error", data => this.emit({ type: "error", data }));
  }
  subscribe(listener: (event: InterfaceRunEvent) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private emit(event: InterfaceRunEvent) { this.listeners.forEach(fn => fn(event)); }
  status() { return this.wsClient?.send("/etl/interface-run/status", {}) ?? false; }
  start(request: InterfaceRunRequest) { return this.wsClient?.send("/etl/interface-run/start", request) ?? false; }
  prepare(request: ProjectInterfaceContextRequest) { return this.wsClient?.send("/etl/interface-run/prepare", request) ?? false; }
  stop(runId: string, requestId: string) { return this.wsClient?.send("/etl/interface-run/stop", { runId, requestId }) ?? false; }
}
