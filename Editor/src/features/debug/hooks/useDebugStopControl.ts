import { useEffect, useRef, useState } from "react";
import { debugProtocolClient } from "@/services/server";
import { useDebugSessionStore } from "@/stores/debug/debugSessionStore";
import { message } from "@/utils/ui/antdAppApi";

export function useDebugStopControl() {
  const session = useDebugSessionStore((state) => state.session);
  const activeRun = useDebugSessionStore((state) => state.activeRun);
  const lastError = useDebugSessionStore((state) => state.lastError);
  const [pendingStopRunId, setPendingStopRunId] = useState<string>();
  const stopRequestLock = useRef<string | undefined>(undefined);
  const stopPending = session?.status === "stopping" ||
    (session?.status === "running" && pendingStopRunId === activeRun?.runId && Boolean(pendingStopRunId));

  useEffect(() => {
    if (lastError?.code === "debug_run_stop_failed" && stopRequestLock.current) {
      message.error(lastError.message || "停止调试失败，请重试");
    }
    if (session?.status !== "running" || lastError?.code === "debug_run_stop_failed") {
      stopRequestLock.current = undefined;
      setPendingStopRunId(undefined);
    }
  }, [session?.status, activeRun?.runId, lastError]);

  const stopRun = () => {
    if (stopPending || stopRequestLock.current === activeRun?.runId) return;
    if (!session?.sessionId) {
      message.warning("当前没有调试会话（Session）");
      return;
    }
    if (session.status !== "running" || !activeRun?.runId) {
      message.warning("当前没有运行中的调试任务");
      return;
    }
    useDebugSessionStore.getState().clearProtocolError();
    stopRequestLock.current = activeRun.runId;
    setPendingStopRunId(activeRun.runId);
    const sent = debugProtocolClient.stopRun({
      sessionId: session.sessionId,
      runId: activeRun.runId,
      reason: "user_stop",
    });
    if (!sent) {
      stopRequestLock.current = undefined;
      setPendingStopRunId(undefined);
      message.error("发送停止请求失败");
    }
  };

  return { stopRun, stopPending };
}
