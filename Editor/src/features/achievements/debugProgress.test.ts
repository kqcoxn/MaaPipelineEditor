import { describe, expect, it, vi } from "vitest";
import type { DebugEvent, DebugRunMode } from "@/features/debug/types";
import { createDebugAchievementTracker } from "./debugProgress";

function event(runId: string, phase: DebugEvent["phase"], extra: Partial<DebugEvent> = {}): DebugEvent {
  return { runId, sessionId: "session", seq: 1, timestamp: "2026-09-08T00:00:00Z", source: "localbridge", kind: "session", phase, ...extra };
}
function setup() {
  const award = vi.fn();
  const tracker = createDebugAchievementTracker(award);
  const start = (runId: string, mode: DebugRunMode = "run-from-node", entry = "Entry") => tracker.start({ runId, mode, entry, sessionId: "session" }, "file", ["resource"]);
  return { tracker, award, start };
}

describe("调试成就因果链", () => {
  it("区分流程、单节点、回放与停止，重复终态不重复计数", () => {
    const { tracker, award, start } = setup();
    start("flow"); tracker.event(event("flow", "completed"));
    tracker.event(event("flow", "completed"));
    start("flow"); tracker.event(event("flow", "completed"));
    start("single", "single-node-run"); tracker.event(event("single", "completed"));
    start("replay", "replay"); tracker.event(event("replay", "completed"));
    start("stop"); tracker.event(event("stop", "completed", { status: "stopped" }));
    expect(award.mock.calls.flat()).toEqual(["debug_run_completed", "debug_single_completed"]);
  });

  it("仅识别需要实际识别结果，未命中也算结果但不算流程成功", () => {
    const { tracker, award, start } = setup();
    start("reco", "recognition-only");
    tracker.event(event("reco", "starting", { kind: "recognition" }));
    expect(award).not.toHaveBeenCalled();
    tracker.event(event("reco", "failed", { kind: "recognition" }));
    tracker.event(event("reco", "failed", { kind: "recognition" }));
    tracker.event(event("reco", "failed"));
    expect(award.mock.calls.flat()).toEqual(["debug_recognition_result"]);
  });

  it("同入口失败、定位跨文件失败节点、编辑后成功可解锁两个重试成就", () => {
    const { tracker, award, start } = setup();
    start("failed");
    tracker.event(event("failed", "failed", { kind: "node", node: { fileId: "remote", nodeId: "node", runtimeName: "Node" } }));
    tracker.event(event("failed", "failed"));
    tracker.focusFailure("failed", "remote", "node");
    tracker.edit("remote", "node");
    start("success"); tracker.event(event("success", "completed"));
    expect(award.mock.calls.flat()).toEqual(["debug_run_completed", "debug_retry_completed", "debug_fix_completed"]);
  });

  it("无编辑、无关文件编辑和其他入口都不能解锁重试", () => {
    const { tracker, award, start } = setup();
    start("failed"); tracker.event(event("failed", "failed"));
    tracker.edit("unrelated", "node");
    start("success"); tracker.event(event("success", "completed"));
    start("failed2"); tracker.event(event("failed2", "failed"));
    tracker.edit("file", "node");
    start("other", "run-from-node", "Other"); tracker.event(event("other", "completed"));
    expect(award.mock.calls.flat()).toEqual(["debug_run_completed", "debug_run_completed"]);
  });

  it("运行开始之后的编辑、修改其他节点不满足修复彩蛋", () => {
    const { tracker, award, start } = setup();
    start("failed"); tracker.event(event("failed", "failed"));
    tracker.focusFailure("failed", "file", "broken");
    tracker.edit("file", "other");
    start("success");
    tracker.edit("file", "broken");
    tracker.event(event("success", "completed"));
    expect(award.mock.calls.flat()).toEqual(["debug_run_completed", "debug_retry_completed"]);
  });

  it("下一次同入口运行失败或停止会消耗修复彩蛋机会", () => {
    for (const status of ["failed", "stopped"] as const) {
      const { tracker, award, start } = setup();
      start("failed"); tracker.event(event("failed", "failed"));
      tracker.focusFailure("failed", "file", "broken"); tracker.edit("file", "broken");
      start("retry"); tracker.event(event("retry", status === "failed" ? "failed" : "completed", { status }));
      start("later"); tracker.event(event("later", "completed"));
      expect(award.mock.calls.flat()).not.toContain("debug_fix_completed");
    }
  });
});
