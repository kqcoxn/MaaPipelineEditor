import type {
  DebugDiagnostic,
  DebugEvent,
  DebugRunMode,
  DebugRunRequest,
} from "./types";
import { formatDebugNodeDisplayName } from "./syntheticNode";

export const runnableModes = new Set<DebugRunMode>([
  "run-from-node",
  "single-node-run",
  "recognition-only",
  "action-only",
]);

export const targetRunModes = new Set<DebugRunMode>([
  "run-from-node",
  "single-node-run",
  "recognition-only",
  "action-only",
]);

export function dataArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function stringArray(value: unknown): string[] {
  return dataArray(value).filter(
    (item): item is string => typeof item === "string",
  );
}

export function formatTime(value?: string): string {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString();
}

export function eventTitle(event: DebugEvent): string {
  return [
    `#${event.seq}`,
    event.kind,
    event.phase,
    formatDebugNodeDisplayName(event.node),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function validateRunRequest(
  request: DebugRunRequest,
): DebugDiagnostic[] {
  const diagnostics: DebugDiagnostic[] = [];
  if (!request.profile.controller.options.controllerId) {
    diagnostics.push({
      severity: "error",
      code: "debug.controller.missing",
      message: "设备未连接：缺少已连接控制器（Controller），无法启动调试。",
    });
  }
  if (request.profile.resourcePaths.length === 0) {
    diagnostics.push({
      severity: "error",
      code: "debug.resource.empty",
      message:
        "资源路径（Resource Paths）为空，请配置资源路径或刷新 LocalBridge 资源包（Resource Bundle）。",
    });
  }
  if (!request.graphSnapshot.files.length) {
    diagnostics.push({
      severity: "error",
      code: "debug.graph.empty",
      message: "当前图快照为空，无法启动调试。",
    });
  }
  if (!request.resolverSnapshot.nodes.length) {
    diagnostics.push({
      severity: "error",
      code: "debug.resolver.empty",
      message: "当前没有可映射到运行时的 Pipeline 节点。",
    });
  }
  if (targetRunModes.has(request.mode) && !request.target?.runtimeName) {
    diagnostics.push({
      severity: "error",
      code: "debug.target.missing",
      message: "节点级调试缺少目标节点（Target）。",
    });
  }
  if (request.mode === "action-only" && !request.input?.confirmAction) {
    diagnostics.push({
      severity: "error",
      code: "debug.action.confirm_missing",
      message: "仅动作模式需要危险操作确认。",
    });
  }
  return diagnostics;
}
