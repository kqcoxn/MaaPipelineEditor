import { useEffect, useMemo, useState } from "react";
import { useDebugTraceStore } from "@/stores/debug/debugTraceStore";
import type { DebugRunStarted } from "../types";
import { createDebugActivityProjector } from "../state/debugActivityReducer";

/** 事件只在 trace 变化时归纳；计时每 250ms 更新，不重复扫描事件。 */
export function useDebugActivity(run: DebugRunStarted, terminal: boolean) {
  const events = useDebugTraceStore((state) => state.events);
  const project = useMemo(
    () => createDebugActivityProjector(run.sessionId, run.runId),
    [run.sessionId, run.runId],
  );
  const activity = useMemo(() => project(events), [project, events]);
  const [elapsed, setElapsed] = useState(0);
  const anchor = useMemo(() => ({ local: performance.now(), remote: activity.latestAt ?? Date.parse(run.startedAt) }),
    [activity.latestAt, run.startedAt]);

  useEffect(() => {
    setElapsed(0);
    if (terminal) return;
    const timer = setInterval(() => setElapsed(performance.now() - anchor.local), 250);
    return () => clearInterval(timer);
  }, [anchor, terminal]);

  return {
    activity,
    now: activity.terminalAt ?? (Number.isFinite(anchor.remote) ? anchor.remote : 0) + (terminal ? 0 : elapsed),
  };
}
