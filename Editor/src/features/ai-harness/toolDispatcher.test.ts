import { describe, expect, it } from "vitest";
import { canvasCapabilityPack, createCanvasHarnessRegistry } from "./canvasTools";
import { canvasChatProfile } from "./registry";
import { ToolDispatcher } from "./toolDispatcher";
import type { HarnessRun } from "./types";

const run: HarnessRun = {
  id: "run-1",
  sessionId: "session-1",
  goal: "读取画布",
  status: "running",
  createdAt: 1,
  profileSnapshot: canvasChatProfile,
  capabilitySnapshot: canvasCapabilityPack,
  policySnapshot: canvasChatProfile.defaultPolicy,
  modelSnapshot: {
    type: "openai",
    apiUrl: "https://example.com",
    model: "test",
    temperature: 0,
  },
  turnCount: 0,
  toolCallCount: 0,
  tokenUsage: {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    isEstimated: false,
  },
  changedCanvas: false,
};

const context = {
  runId: "run-1",
  sessionId: "session-1",
  fileName: "demo.json",
  expectedStateVersion: 1,
  signal: new AbortController().signal,
};

describe("ToolDispatcher", () => {
  it("拒绝非法工具和非法参数", async () => {
    const dispatcher = new ToolDispatcher(createCanvasHarnessRegistry(), {
      read_node: async () => ({ ok: true, stateVersion: 1 }),
    });
    const budget = { toolCallCount: 0, fingerprints: new Set<string>() };

    expect(
      (
        await dispatcher.dispatch(
          { id: "1", name: "shell", arguments: {} },
          run,
          canvasCapabilityPack,
          context,
          budget,
        )
      ).error?.code,
    ).toBe("permission_denied");
    expect(
      (
        await dispatcher.dispatch(
          { id: "2", name: "read_node", arguments: {} },
          run,
          canvasCapabilityPack,
          context,
          budget,
        )
      ).error?.code,
    ).toBe("invalid_arguments");
  });

  it("通过指纹拒绝重复工具调用", async () => {
    const handler = async () => ({ ok: true, stateVersion: 1 });
    const dispatcher = new ToolDispatcher(createCanvasHarnessRegistry(), {
      read_canvas_summary: handler,
    });
    const budget = { toolCallCount: 0, fingerprints: new Set<string>() };
    const call = { id: "1", name: "read_canvas_summary", arguments: {} };

    expect(
      (await dispatcher.dispatch(call, run, canvasCapabilityPack, context, budget)).ok,
    ).toBe(true);
    expect(
      (
        await dispatcher.dispatch(call, run, canvasCapabilityPack, context, budget)
      ).error?.message,
    ).toContain("重复");
  });
});
