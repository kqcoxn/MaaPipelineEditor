import { useEffect, useRef } from "react";
import { Button, notification } from "antd";
import uiT from "../../../i18n/translate";
import { useDebugTraceStore } from "../../../stores/debugTraceStore";
import { useDebugSessionStore } from "../../../stores/debugSessionStore";
import { getRunModeLabel } from "../capabilityLabels";
import type { DebugRunMode } from "../types";

function isTerminalDebugSessionStatus(status?: string): boolean {
  return status === "completed" || status === "failed" || status === "stopped";
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    return uiT("ui.debug.runStatus.unknown", "未知");
  }
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m${s}s`;
}

function getStatusLabel(status?: string): string {
  switch (status) {
    case "completed":
      return uiT("ui.debug.runStatus.completed", "运行成功");
    case "failed":
      return uiT("ui.debug.runStatus.failed", "运行失败");
    case "stopped":
      return uiT("ui.debug.runStatus.stopped", "运行已停止");
    default:
      return uiT("ui.debug.runStatus.finished", "运行结束");
  }
}

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
      seenRunningRef.current.add(sessionKey);
      sessionStore.setRunBadgeStatus("running");
      return;
    }

    sessionStore.setRunBadgeStatus(
      latest.status as "completed" | "failed" | "stopped",
    );

    if (!seenRunningRef.current.has(sessionKey)) return;
    if (notifiedRef.current.has(sessionKey)) return;
    notifiedRef.current.add(sessionKey);

    if (sessionStore.modalOpen) return;

    const started = Date.parse(latest.startedAt ?? "");
    const completed = Date.parse(latest.completedAt ?? "");
    const durationMs =
      Number.isFinite(started) && Number.isFinite(completed)
        ? completed - started
        : undefined;

    const statusLabel = getStatusLabel(latest.status);
    const modeLabel = latest.mode
      ? getRunModeLabel(latest.mode as DebugRunMode)
      : uiT("ui.debug.runStatus.unknown", "未知");
    const notifyKey = `debug-run-finished-${sessionKey}`;

    const method =
      latest.status === "completed"
        ? notification.success
        : latest.status === "failed"
          ? notification.error
          : notification.warning;

    method({
      key: notifyKey,
      title: uiT("ui.debug.runStatus.notificationTitle", "调试{{status}}", {
        status: statusLabel,
      }),
      description: uiT(
        "ui.debug.runStatus.notificationDesc",
        "模式：{{mode}}{{durationPart}}",
        {
          mode: modeLabel,
          durationPart:
            durationMs !== undefined
              ? uiT("ui.debug.runStatus.durationPart", " | 耗时：{{duration}}", {
                  duration: formatDuration(durationMs),
                })
              : "",
        },
      ),
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
          {uiT("ui.debug.runStatus.viewDetails", "查看详情")}
        </Button>
      ),
    });
  }, [displaySessions]);
}
