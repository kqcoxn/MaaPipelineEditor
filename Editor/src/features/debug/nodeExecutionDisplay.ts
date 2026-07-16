import type { DebugEventKind } from "./types";

export const debugNodeExecutionEventKindLabels: Record<DebugEventKind, string> = {
  session: "Session",
  task: "Task",
  node: "Node",
  "next-list": "Next",
  recognition: "识别",
  action: "动作",
  "wait-freezes": "WaitFreezes",
  screenshot: "截图",
  diagnostic: "诊断",
  artifact: "Artifact",
  log: "日志",
};

export function formatDebugNodeExecutionDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(2)}s`;
}
