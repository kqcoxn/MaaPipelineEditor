import { describe, expect, it } from "vitest";
import {
  canvasCapabilityPack,
  createDefaultHarnessDependencies,
} from "../composition/defaultHarness";
import { canvasChatProfile } from "../capabilities/canvas/profile";
import { ToolDispatcher } from "./toolDispatcher";
import type { HarnessRun } from "../core/types";

const run: HarnessRun = {
  id: "run-1",
  sessionId: "session-1",
  goal: "读取画布",
  status: "running",
  createdAt: 1,
  profileSnapshot: canvasChatProfile,
  capabilitySnapshot: canvasCapabilityPack,
  policySnapshot: {
    ...canvasChatProfile.defaultPolicy,
    compactionThresholdTokens: 200_000,
  },
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
  it("通过受控工具读取 MaaFramework Pipeline Skill 参考资料", async () => {
    const { registry, toolHandlers } = createDefaultHarnessDependencies();
    const dispatcher = new ToolDispatcher(registry, toolHandlers);
    const result = await dispatcher.dispatch(
      {
        id: "mfw-reference",
        name: "read_mfw_pipeline_reference",
        arguments: { section: "动作类型/Click" },
      },
      run,
      canvasCapabilityPack,
      context,
      { toolCallCount: 0, fingerprints: new Set<string>() },
    );

    expect(result.ok).toBe(true);
    expect((result.data as { content: string }).content).toContain(
      "target: true | string | [x,y] | [x,y,w,h]",
    );
  });

  it("拒绝非法工具和非法参数", async () => {
    const { registry } = createDefaultHarnessDependencies();
    const dispatcher = new ToolDispatcher(registry, {
      read_node: async () => ({ ok: true, stateVersion: 1 }),
    });
    const budget = { toolCallCount: 0, fingerprints: new Set<string>() };

    expect(
      (
        await dispatcher.dispatch(
          { id: "empty", name: "", arguments: {} },
          run,
          canvasCapabilityPack,
          context,
          budget,
        )
      ).error?.code,
    ).toBe("invalid_arguments");

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
    expect(budget.toolCallCount).toBe(3);
  });

  it("通过指纹拒绝重复工具调用", async () => {
    const handler = async () => ({ ok: true, stateVersion: 1 });
    const { registry } = createDefaultHarnessDependencies();
    const dispatcher = new ToolDispatcher(registry, {
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
