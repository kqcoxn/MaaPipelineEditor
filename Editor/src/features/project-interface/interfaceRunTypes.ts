import type { ProjectInterfaceContextRequest } from "./types";
export type InterfaceRunStatus = "idle" | "preparing" | "running" | "stopping" | "completed" | "failed" | "stopped";
export interface InterfaceRunState {
  runId: string;
  requestId: string;
  projectId: string;
  revision: string;
  controllerId: string;
  controllerName: string;
  resourceName: string;
  status: InterfaceRunStatus;
  items: Array<{ name: string; label: string; entry: string; status: string }>;
  logs: Array<{ sequence: number; time: string; level: string; message: string }>;
  sequence: number;
  startedAt: string;
}
export interface InterfaceRunRequest {
  requestId: string;
  projectId: string;
  controllerId: string;
  preparationId?: string;
  tasks: ProjectInterfaceContextRequest[];
}
export const isInterfaceRunning = (status?: string) => ["preparing", "running", "stopping"].includes(status ?? "");
export const runStatusLabels: Record<string, string> = { idle: "就绪", preparing: "准备中", running: "运行中", stopping: "停止中", completed: "已完成", failed: "失败", stopped: "已停止", pending: "等待中", skipped: "未执行" };
