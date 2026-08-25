import { beforeEach, describe, expect, it } from "vitest";
import type { DebugEvent } from "../../features/debug/types";
import { useDebugTraceStore } from "./debugTraceStore";

beforeEach(() => {
  useDebugTraceStore.getState().resetTrace();
});

describe("debugTraceStore", () => {
  it("preserves a failed run reason on its display session", () => {
    const failedEvent: DebugEvent = {
      sessionId: "session-1",
      runId: "run-1",
      seq: 1,
      timestamp: "2026-08-25T14:00:00.000Z",
      source: "maafw",
      kind: "session",
      phase: "failed",
      status: "failed",
      data: {
        error:
          "MaaFramework 提交任务失败：\nregex invalid [name=新建节点33]",
        errorCode: "maafw.task.submit_failed",
        errorSource: "maafw",
      },
    };

    useDebugTraceStore.getState().appendEvent(failedEvent);

    expect(useDebugTraceStore.getState().displaySessions[0]?.failure).toEqual({
      code: "maafw.task.submit_failed",
      message:
        "MaaFramework 提交任务失败：\nregex invalid [name=新建节点33]",
      source: "maafw",
    });
  });

  it("appends a burst in one store update and deduplicates events", () => {
    const events = Array.from({ length: 500 }, (_, index): DebugEvent => ({
      sessionId: "session-1",
      runId: "run-1",
      seq: index + 1,
      timestamp: `2026-08-25T14:00:00.${String(index).padStart(3, "0")}Z`,
      source: "maafw",
      kind: "node",
      phase: "running",
    }));
    let updates = 0;
    const unsubscribe = useDebugTraceStore.subscribe(() => {
      updates += 1;
    });

    useDebugTraceStore.getState().appendEvents([...events, events[0]]);
    unsubscribe();

    expect(updates).toBe(1);
    expect(useDebugTraceStore.getState().events).toHaveLength(500);
  });
});
