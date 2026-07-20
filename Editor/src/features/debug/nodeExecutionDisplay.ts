import uiT from "../../i18n/translate";
import type { DebugEventKind } from "./types";

export function getDebugNodeExecutionEventKindLabel(
  kind: DebugEventKind,
): string {
  switch (kind) {
    case "recognition":
      return uiT("debug.nodeExecution.eventKind.recognition", "识别");
    case "action":
      return uiT("debug.nodeExecution.eventKind.action", "动作");
    case "screenshot":
      return uiT("debug.nodeExecution.eventKind.screenshot", "截图");
    case "diagnostic":
      return uiT("debug.nodeExecution.eventKind.diagnostic", "诊断");
    case "log":
      return uiT("debug.nodeExecution.eventKind.log", "日志");
    default:
      return kind;
  }
}

/** @deprecated Use getDebugNodeExecutionEventKindLabel for translated labels. */
export const debugNodeExecutionEventKindLabels: Record<DebugEventKind, string> =
  new Proxy({} as Record<DebugEventKind, string>, {
    get(_target, prop: string) {
      return getDebugNodeExecutionEventKindLabel(prop as DebugEventKind);
    },
  });

export function formatDebugNodeExecutionDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(2)}s`;
}
