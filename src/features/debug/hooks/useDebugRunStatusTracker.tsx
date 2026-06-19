import { useEffect, useRef } from "react";
import { Button, notification } from "antd";
import { useDebugTraceStore } from "../../../stores/debugTraceStore";
import { useDebugSessionStore } from "../../../stores/debugSessionStore";
import { getRunModeLabel } from "../capabilityLabels";
import type { DebugRunMode } from "../types";

function isTerminalDebugSessionStatus(status?: string): boolean {
  return status === "completed" || status === "failed" || status === "stopped";
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "未知";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m${s}s`;
}

const statusLabels: Record<string, string> = {
  completed: "运行成功",
  failed: "运行失败",
  stopped: "运行已停止",
};

/**
 * 追踪调试运行状态：
 * 1. 更新 debugSessionStore.runBadgeStatus（供工具栏 badge 显示）
 * 2. 运行进入终态时弹出 notification（仅对实时运行触发，回放历史不触发）
 */
export function useDebugRunStatusTracker(): void {
  const displaySessions = useDebugTraceStore((s) => s.displaySessions);
  const seenRunningRef = useRef<Set<string>>(new Set());
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const latest = displaySessions[0];
    if (!latest) return;

    const sessionKey = `${latest.sessionId}:${latest.runId}`;
    const sessionStore = useDebugSessionStore.getState();

    if (!isTerminalDebugSessionStatus(latest.status)) {
      // 记录见过非终态的会话（区分实时运行 vs 回放历史）
      seenRunningRef.current.add(sessionKey);
      sessionStore.setRunBadgeStatus("running");
      return;
    }

    // 终态：更新 badge
    sessionStore.setRunBadgeStatus(
      latest.status as "completed" | "failed" | "stopped",
    );

    // 仅对"见过运行中"的会话发通知（跳过回放/快照加载的历史会话）
    if (!seenRunningRef.current.has(sessionKey)) return;
    if (notifiedRef.current.has(sessionKey)) return;
    notifiedRef.current.add(sessionKey);

    // 调试窗口已打开则不弹通知
    if (sessionStore.modalOpen) return;

    const started = Date.parse(latest.startedAt ?? "");
    const completed = Date.parse(latest.completedAt ?? "");
    const durationMs =
      Number.isFinite(started) && Number.isFinite(completed)
        ? completed - started
        : undefined;

    const statusLabel = statusLabels[latest.status ?? ""] ?? "运行结束";
    const modeLabel = latest.mode
      ? getRunModeLabel(latest.mode as DebugRunMode)
      : "未知";
    const notifyKey = `debug-run-finished-${sessionKey}`;

    const method =
      latest.status === "completed"
        ? notification.success
        : latest.status === "failed"
          ? notification.error
          : notification.warning;

    method({
      key: notifyKey,
      title: `调试${statusLabel}`,
      description: `模式：${modeLabel}${durationMs !== undefined ? ` | 耗时：${formatDuration(durationMs)}` : ""}`,
      duration: 6,
      placement: "top",
      actions: (
        <Button
          type="link"
          size="small"
          onClick={() => {
            useDebugSessionStore.getState().openModal();
            notification.destroy(notifyKey);
          }}
        >
          查看详情
        </Button>
      ),
    });
  }, [displaySessions]);
}
