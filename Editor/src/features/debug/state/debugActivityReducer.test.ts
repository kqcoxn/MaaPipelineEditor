import { describe, expect, it } from "vitest";
import type { DebugEvent } from "../types";
import { createDebugActivityProjector } from "./debugActivityReducer";

function event(seq: number, kind: DebugEvent["kind"], phase: DebugEvent["phase"], data: Record<string, unknown> = {}, name = "A"): DebugEvent {
  return {
    seq, sessionId: "s", runId: "r", taskId: 1, kind, phase, data,
    node: { runtimeName: name }, source: "maafw",
    timestamp: new Date(seq * 1000).toISOString(),
  };
}
const next = [{ name: "B" }, { name: "C" }];

describe("实时调试阶段投影", () => {
  it("扫描失败只结束本轮，搜索时钟跨轮保持，命中结束搜索", () => {
    const project = createDebugActivityProjector("s", "r");
    const events = [
      event(1, "node", "starting", { nodeId: 1, runtime: { timeout: 20000 } }),
      event(2, "next-list", "starting", { next }),
      event(3, "recognition", "starting", { recognitionId: 10 }, "B"),
      event(4, "recognition", "failed", { recognitionId: 10 }, "B"),
      event(5, "next-list", "failed", { next }),
    ];
    const failedRound = project(events);
    expect(failedRound.status).toBeUndefined();
    expect(failedRound.frames[0].search).toMatchObject({ startedAt: 1000, round: 1, roundStatus: "miss", timeoutMs: 20000 });
    events.push(event(6, "next-list", "starting", { next }),
      event(7, "recognition", "starting", { recognitionId: 11 }, "C"),
      event(8, "recognition", "succeeded", { recognitionId: 11 }, "C"),
      event(9, "next-list", "succeeded", { next }));
    const hit = project(events);
    expect(hit.totalRounds).toBe(2);
    expect(hit.recognitionCount).toBe(2);
    expect(hit.frames[0].search).toMatchObject({ startedAt: 1000, endedAt: 9000, round: 2 });
    expect(hit.frames[0].search?.candidates.map((candidate) => candidate.status)).toEqual(["pending", "hit"]);
    expect(failedRound.frames[0].search?.round).toBe(1);
  });

  it("同名节点再次进入时重置轮次，嵌套任务结束后恢复外层动作", () => {
    const project = createDebugActivityProjector("s", "r");
    const events = [event(1, "node", "starting", { nodeId: 1 }),
      event(2, "action", "starting", { actionId: 10, runtime: { action: "Custom", customAction: "Nested" } }),
      event(3, "node", "starting", { nodeId: 2 }),
      event(4, "next-list", "starting", { next }),
      event(5, "next-list", "failed", { next }),
      event(6, "node", "failed", { nodeId: 2 })];
    const nested = project(events);
    expect(nested.frames).toHaveLength(1);
    expect(nested.frames[0].operations[0]).toMatchObject({ customName: "Nested", startedAt: 2000 });
    events.push(event(7, "action", "succeeded", { actionId: 10 }),
      event(8, "node", "succeeded", { nodeId: 1 }),
      event(9, "node", "starting", { nodeId: 3 }),
      event(10, "next-list", "starting", { next }));
    expect(project(events).frames[0].search).toMatchObject({ startedAt: 9000, round: 1 });
  });

  it("Custom 内部识别不冒充外层列表候选，重复的起始事件不重复计数", () => {
    const project = createDebugActivityProjector("s", "r");
    const result = project([
      event(1, "node", "starting", { nodeId: 1 }),
      event(2, "next-list", "starting", { next }),
      event(3, "recognition", "starting", { recognitionId: 10 }, "B"),
      event(4, "recognition", "starting", { recognitionId: 10 }, "B"),
      event(5, "recognition", "starting", { recognitionId: 11 }, "C"),
      event(6, "recognition", "succeeded", { recognitionId: 11 }, "C"),
    ]);
    expect(result.recognitionCount).toBe(2);
    expect(result.frames[0].search?.attempted).toBe(1);
    expect(result.frames[0].search?.candidates[1].status).toBe("pending");
    expect(result.frames[0].operations[0].name).toBe("B");
  });

  it("忽略其他运行，快照替换后重建，终态之后不再增加计数", () => {
    const project = createDebugActivityProjector("s", "r");
    project([event(1, "next-list", "starting", { next })]);
    const result = project([
      { ...event(1, "next-list", "starting", { next }), runId: "history" },
      event(2, "session", "completed", { error: "timeout" }),
      event(3, "recognition", "starting", { recognitionId: 1 }),
    ]);
    expect(result.totalRounds).toBe(0);
    expect(result.recognitionCount).toBe(0);
    expect(result.terminalAt).toBe(2000);
  });

  it("仅识别外层通知不重复统计，focus 只呈现支持的内联文本", () => {
    const project = createDebugActivityProjector("s", "r");
    const result = project([
      { ...event(1, "recognition", "starting", { nodeId: 3 }), maafwMessage: "Node.RecognitionNode.Starting" },
      { ...event(2, "recognition", "starting", { recognitionId: 4, focus: { "Node.Recognition.Starting": "{name} 正在查找" } }), maafwMessage: "Node.Recognition.Starting" },
    ]);
    expect(result.recognitionCount).toBe(1);
    expect(result.frames[0].focus).toBe("A 正在查找");
  });
});
