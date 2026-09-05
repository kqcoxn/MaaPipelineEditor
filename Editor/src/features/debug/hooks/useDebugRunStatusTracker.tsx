import { useEffect } from "react";
import { useDebugTraceStore } from "@/stores/debug/debugTraceStore";
import { useDebugSessionStore } from "@/stores/debug/debugSessionStore";

/** 工具栏保留运行标记，运行结果由悬浮胶囊展示。 */
export function useDebugRunStatusTracker(): void {
  const status = useDebugTraceStore((state) => state.displaySessions[0]?.status);

  useEffect(() => {
    if (!status) return;
    const badgeStatus =
      status === "completed" || status === "failed" || status === "stopped"
        ? status
        : "running";
    useDebugSessionStore.getState().setRunBadgeStatus(badgeStatus);
  }, [status]);
}
