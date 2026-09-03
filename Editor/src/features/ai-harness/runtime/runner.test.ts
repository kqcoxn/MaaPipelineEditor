import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UnifiedMessage, UnifiedResponse } from "@/utils/ai/providers";
import {
  DEFAULT_AI_CONTEXT_COMPACTION_THRESHOLD,
  useConfigStore,
} from "@/stores/app/configStore";

const modelMock = vi.hoisted(() => {
  const snapshot = {
    type: "openai" as const,
    apiUrl: "https://example.com",
    model: "test-model",
    temperature: 0,
  };
  return {
    abort: vi.fn(),
    complete: vi.fn<
      (messages: UnifiedMessage[]) => Promise<UnifiedResponse>
    >(),
    freezeModelConfig: vi.fn(async () => snapshot),
    getModelConfigSnapshot: vi.fn(async () => snapshot),
  };
});

const canvasMock = vi.hoisted(() => ({
  apply: vi.fn(() => ({
    ok: true,
    stateVersion: 2,
    changes: ["创建节点 结束"],
    undoable: true,
  })),
  getStateVersion: vi.fn(() => 1),
  readNode: vi.fn(() => ({ ok: true, stateVersion: 1, data: { id: "1" } })),
  readNodes: vi.fn((nodeIds: string[]) => ({
    ok: true,
    stateVersion: 1,
    data: { nodes: nodeIds.map((id) => ({ id })), missingNodeIds: [] },
  })),
  readSelection: vi.fn(() => ({ ok: true, stateVersion: 1, data: {} })),
  readSummary: vi.fn(() => ({
    ok: true,
    stateVersion: 1,
    data: {
      fileName: "demo.json",
      nodeCount: 1,
      connectionCount: 0,
      stateVersion: 1,
      nodes: [{ id: "1", name: "开始", type: "pipeline" }],
      connections: [],
    },
  })),
  validateCanvas: vi.fn(() => ({
    ok: true,
    stateVersion: 2,
    data: { valid: true },
    validationErrors: [],
  })),
}));

vi.mock("@/utils/ai/aiClient", () => ({
  AIClient: class {
    abort = modelMock.abort;
    complete = modelMock.complete;
    freezeModelConfig = modelMock.freezeModelConfig;
    getModelConfigSnapshot = modelMock.getModelConfigSnapshot;
  },
}));

vi.mock("../capabilities/canvas/commandBus", () => ({
  canvasCommandBus: canvasMock,
}));

import { HarnessRunner } from "./runner";
import { useAIHarnessStore } from "../state/store";
import { canvasToolDefinitions } from "../capabilities/canvas/tools";
import {
  mfwPipelineReferenceTool,
  MFW_PIPELINE_SKILL_ID,
} from "../skills/mfw-pipeline/definition";
import { SEMANTIC_LAYOUT_PROFILE_ID } from "../capabilities/semantic-layout/profile";
import { createDefaultHarnessDependencies } from "../composition/defaultHarness";

function createRunner(): HarnessRunner {
  return new HarnessRunner(createDefaultHarnessDependencies());
}

const finalResponse = (content = "完成"): UnifiedResponse => ({
  success: true,
  content,
  toolCalls: [],
  finishReason: "stop",
});

const readToolResponse = (nodeId = "1"): UnifiedResponse => ({
  success: true,
  content: "",
  toolCalls: [
    {
      id: `call-${nodeId}`,
      name: "read_node",
      arguments: { nodeId },
    },
  ],
  finishReason: "tool_calls",
});

async function waitForRun(runId: string) {
  await vi.waitFor(() => {
    expect(
      ["succeeded", "failed", "cancelled", "partial"],
    ).toContain(useAIHarnessStore.getState().runs[runId]?.status);
  });
  return useAIHarnessStore.getState().runs[runId];
}

describe("HarnessRunner", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    useAIHarnessStore.getState().reset();
    useConfigStore.getState().resetAllConfigs();
    modelMock.freezeModelConfig.mockResolvedValue({
      type: "openai",
      apiUrl: "https://example.com",
      model: "test-model",
      temperature: 0,
    });
    modelMock.getModelConfigSnapshot.mockResolvedValue({
      type: "openai",
      apiUrl: "https://example.com",
      model: "test-model",
      temperature: 0,
    });
  });

  it("完成工具循环并保存最终消息", async () => {
    modelMock.complete
      .mockResolvedValueOnce(readToolResponse())
      .mockResolvedValueOnce(finalResponse("读取完成"));
    const runner = createRunner();

    const runId = await runner.start("读取当前节点");
    const run = await waitForRun(runId);

    expect(run.status).toBe("succeeded");
    expect(run.toolCallCount).toBe(1);
    expect(run.capabilitySnapshot.toolNames).toEqual(
      [...canvasToolDefinitions, mfwPipelineReferenceTool].map(
        (tool) => tool.name,
      ),
    );
    expect(run.capabilitySnapshot.skillIds).toEqual([MFW_PIPELINE_SKILL_ID]);
    expect(
      modelMock.complete.mock.calls[0][0].some((message) =>
        message.content.includes("本次 Run 已启用的全部 MPE 工具"),
      ),
    ).toBe(true);
    expect(
      modelMock.complete.mock.calls[0][0].some((message) =>
        message.content.includes("Pipeline 处理工作流"),
      ),
    ).toBe(true);
    expect(
      modelMock.complete.mock.calls[0][0].some((message) =>
        message.content.includes("必须使用 fenced ```mermaid 代码块"),
      ),
    ).toBe(true);
    expect(
      modelMock.complete.mock.calls[0][0].some((message) =>
        message.content.includes("read_nodes 批量读取"),
      ),
    ).toBe(true);
    expect(useAIHarnessStore.getState().sessions[0].messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "读取完成",
    });
  });

  it("批量读取多个节点只消耗一次工具调用", async () => {
    modelMock.complete
      .mockResolvedValueOnce({
        success: true,
        content: "",
        toolCalls: [
          {
            id: "batch-read",
            name: "read_nodes",
            arguments: { nodeIds: ["1", "2", "3"] },
          },
        ],
        finishReason: "tool_calls",
      })
      .mockResolvedValueOnce(finalResponse("批量读取完成"));
    const runner = createRunner();

    const run = await waitForRun(await runner.start("读取多个节点"));

    expect(run.status).toBe("succeeded");
    expect(run.toolCallCount).toBe(1);
    expect(canvasMock.readNodes).toHaveBeenCalledWith(
      ["1", "2", "3"],
      expect.objectContaining({ runId: run.id }),
    );
  });

  it("将模型思考保存为独立事件但不写入会话上下文", async () => {
    modelMock.complete.mockResolvedValueOnce({
      ...finalResponse("最终回答"),
      reasoning: "内部分析过程",
    });
    const runner = createRunner();

    const run = await waitForRun(await runner.start("分析当前流程"));
    const state = useAIHarnessStore.getState();

    expect(run.status).toBe("succeeded");
    expect(state.events[run.id]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "assistant_reasoning",
          text: "内部分析过程",
        }),
      ]),
    );
    expect(state.sessions[0].messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "最终回答",
    });
    expect(state.sessions[0].messages.at(-1)?.content).not.toContain(
      "内部分析过程",
    );
  });

  it("工具权限错误后不能由最终文本伪装成功", async () => {
    modelMock.complete
      .mockResolvedValueOnce({
        ...readToolResponse(),
        toolCalls: [{ id: "bad", name: "shell", arguments: {} }],
      })
      .mockResolvedValueOnce(finalResponse());
    const runner = createRunner();

    const run = await waitForRun(await runner.start("执行非法工具"));

    expect(run.status).toBe("failed");
    expect(run.error).toContain("权限");
  });

  it("空工具名且首个 Envelope 非法时自动纠正并继续完成", async () => {
    modelMock.complete
      .mockResolvedValueOnce({
        ...readToolResponse(),
        content: "先读取当前画布状态。",
        toolCalls: [{ id: "empty", name: "", arguments: {} }],
      })
      .mockResolvedValueOnce(finalResponse("这不是 JSON"))
      .mockResolvedValueOnce({
        ...finalResponse(
          '{"type":"tool_calls","calls":[{"name":"read_canvas_summary","arguments":{}}]}',
        ),
      })
      .mockResolvedValueOnce(finalResponse("读取完成"));
    const runner = createRunner();

    const run = await waitForRun(await runner.start("你好"));

    expect(run.status).toBe("succeeded");
    expect(run.toolCallCount).toBe(1);
    expect(
      (useAIHarnessStore.getState().events[run.id] ?? [])
        .filter((event) => event.type === "assistant_message")
        .map((event) => event.text),
    ).toEqual(["先读取当前画布状态。", "读取完成"]);
    expect(
      (useAIHarnessStore.getState().events[run.id] ?? []).filter(
        (event) => event.type === "tool_requested",
      ),
    ).toHaveLength(1);
  });

  it("达到 Turn 和工具次数预算后终止", async () => {
    let runner = createRunner();
    let run: Awaited<ReturnType<typeof waitForRun>>;
    modelMock.complete.mockImplementation(async () =>
      readToolResponse(String(modelMock.complete.mock.calls.length)),
    );
    runner = createRunner();
    run = await waitForRun(await runner.start("超出 Turn"));
    expect(run.turnCount).toBe(12);
    expect(run.error).toContain("Turn");

    modelMock.complete.mockResolvedValueOnce({
      ...readToolResponse(),
      toolCalls: Array.from({ length: 25 }, (_, index) => ({
        id: `budget-${index}`,
        name: "read_node",
        arguments: { nodeId: String(index) },
      })),
    });
    useConfigStore.getState().setConfig("aiToolCallBudget", 24);
    runner = createRunner();
    run = await waitForRun(await runner.start("超出工具预算"));
    expect(run.error).toContain("工具调用");
    expect(run.toolCallCount).toBe(24);
  });

  it("使用用户配置的压缩阈值并冻结到 Run 快照", async () => {
    modelMock.complete.mockResolvedValueOnce(finalResponse());
    const runner = createRunner();
    const runId = await runner.start("检查预算");

    useConfigStore.getState().setConfig("aiContextCompactionThreshold", 80_000);

    const run = await waitForRun(runId);
    expect(run.policySnapshot.compactionThresholdTokens).toBe(
      DEFAULT_AI_CONTEXT_COMPACTION_THRESHOLD,
    );
  });

  it("达到上下文压缩阈值后先压缩再继续 Run", async () => {
    const sessionId = useAIHarnessStore.getState().activeSessionId;
    const oldContent = "旧上下文 ".repeat(900);
    useAIHarnessStore.getState().appendMessage(sessionId, {
      id: "old-user",
      runId: "old-run",
      role: "user",
      content: oldContent,
      createdAt: 1,
    });
    useAIHarnessStore.getState().appendMessage(sessionId, {
      id: "old-assistant",
      runId: "old-run",
      role: "assistant",
      content: oldContent,
      createdAt: 2,
    });
    useConfigStore
      .getState()
      .setConfig("aiContextCompactionThreshold", 1_000);
    modelMock.complete
      .mockResolvedValueOnce(finalResponse("压缩摘要"))
      .mockResolvedValueOnce(finalResponse("继续完成"));
    const runner = createRunner();

    const run = await waitForRun(await runner.start("继续处理"));

    expect(run.status).toBe("succeeded");
    expect(modelMock.complete).toHaveBeenCalledTimes(2);
    expect(modelMock.complete.mock.calls[1][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining("[MPE_CONTEXT_SUMMARY]"),
        }),
      ]),
    );
    expect(useAIHarnessStore.getState().sessions[0].contextSummary).toBe(
      "压缩摘要",
    );
    expect(useAIHarnessStore.getState().sessions[0].messages).toHaveLength(2);
    expect(useAIHarnessStore.getState().sessions[0].messages[0]?.content).toBe(
      "继续处理",
    );
  });

  it("手动 compact 会压缩当前 Session 并保留摘要", async () => {
    const sessionId = useAIHarnessStore.getState().activeSessionId;
    const oldContent = "需要保留的历史事实 ".repeat(900);
    useAIHarnessStore.getState().appendMessage(sessionId, {
      id: "manual-user",
      runId: "manual-run",
      role: "user",
      content: oldContent,
      createdAt: 1,
    });
    useAIHarnessStore.getState().appendMessage(sessionId, {
      id: "manual-assistant",
      runId: "manual-run",
      role: "assistant",
      content: oldContent,
      createdAt: 2,
    });
    useAIHarnessStore.getState().appendMessage(sessionId, {
      id: "manual-user-2",
      runId: "manual-run",
      role: "user",
      content: "当前进度",
      createdAt: 3,
    });
    useAIHarnessStore.getState().appendMessage(sessionId, {
      id: "manual-assistant-2",
      runId: "manual-run",
      role: "assistant",
      content: "等待继续",
      createdAt: 4,
    });
    useConfigStore
      .getState()
      .setConfig("aiContextCompactionThreshold", 1_000);
    modelMock.complete.mockResolvedValueOnce(finalResponse("手动摘要"));
    const runner = createRunner();

    const result = await runner.compact(sessionId, "关注已完成事项");

    expect(result.compacted).toBe(true);
    expect(useAIHarnessStore.getState().sessions[0].contextSummary).toBe(
      "手动摘要",
    );
    expect(useAIHarnessStore.getState().sessions[0].messages).toHaveLength(2);
  });

  it("使用用户配置的工具调用预算并冻结到 Run 快照", async () => {
    useConfigStore.getState().setConfig("aiToolCallBudget", 80);
    modelMock.complete.mockResolvedValueOnce(finalResponse());
    const runner = createRunner();

    const runId = await runner.start("检查工具调用预算");
    useConfigStore.getState().setConfig("aiToolCallBudget", 120);
    const run = await waitForRun(runId);

    expect(run.policySnapshot.maxToolCalls).toBe(80);
  });

  it("允许用户显式取消运行", async () => {
    let resolveRequest: ((response: UnifiedResponse) => void) | undefined;
    modelMock.complete.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    modelMock.abort.mockImplementation(() =>
      resolveRequest?.({
        success: false,
        content: "",
        error: "请求已取消",
        toolCalls: [],
        finishReason: "cancelled",
      }),
    );
    const runner = createRunner();
    const runId = await runner.start("等待取消");
    await vi.waitFor(() => expect(modelMock.complete).toHaveBeenCalled());
    expect(runner.stop(runId)).toBe(true);
    expect((await waitForRun(runId)).status).toBe("cancelled");
  });

  it("原子拒绝并发启动，并在配置失败后释放预约", async () => {
    let resolveSnapshot:
      | ((value: {
          type: "openai";
          apiUrl: string;
          model: string;
          temperature: number;
        }) => void)
      | undefined;
    modelMock.freezeModelConfig.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSnapshot = resolve;
        }),
    );
    modelMock.complete.mockResolvedValue(finalResponse());
    const runner = createRunner();
    const firstStart = runner.start("第一个 Run");

    await expect(runner.start("第二个 Run")).rejects.toThrow("已有 AI Run");
    resolveSnapshot?.({
      type: "openai",
      apiUrl: "https://example.com",
      model: "test-model",
      temperature: 0,
    });
    await firstStart;

    useAIHarnessStore.getState().reset();
    modelMock.freezeModelConfig.mockRejectedValueOnce(new Error("配置失败"));
    await expect(runner.start("失败 Run")).rejects.toThrow("配置失败");
    expect(useAIHarnessStore.getState().pendingRunSessionId).toBeNull();
  });

  it("不同 Session 的上下文不会互相混入", async () => {
    const capturedMessages: UnifiedMessage[][] = [];
    modelMock.complete.mockImplementation(async (messages) => {
      capturedMessages.push(messages);
      return capturedMessages.length % 2 === 1
        ? readToolResponse()
        : finalResponse();
    });
    const runner = createRunner();
    const firstSessionId = useAIHarnessStore.getState().activeSessionId;
    await waitForRun(
      await runner.start("第一会话目标", { sessionId: firstSessionId }),
    );
    const secondSessionId = useAIHarnessStore.getState().createSession("第二会话");
    await waitForRun(
      await runner.start("第二会话目标", { sessionId: secondSessionId }),
    );

    const secondSessionFirstRequest = capturedMessages[2]
      .map((message) => message.content)
      .join("\n");
    expect(secondSessionFirstRequest).toContain("第二会话目标");
    expect(secondSessionFirstRequest).not.toContain("第一会话目标");
  });

  it("专用语义布局 Run 不继承会话历史且必须完成约定工具", async () => {
    const capturedMessages: UnifiedMessage[][] = [];
    modelMock.complete.mockImplementation(async (messages) => {
      capturedMessages.push(messages);
      return finalResponse("已完成");
    });
    const runner = createRunner();
    await waitForRun(await runner.start("此前的普通对话"));

    const run = await waitForRun(
      await runner.start("AI 语义重排当前画布", {
        profileId: SEMANTIC_LAYOUT_PROFILE_ID,
      }),
    );
    const layoutRequest = capturedMessages[1]
      .map((message) => message.content)
      .join("\n");

    expect(run.status).toBe("failed");
    expect(run.error).toContain("未完成必要工具");
    expect(run.profileSnapshot.id).toBe(SEMANTIC_LAYOUT_PROFILE_ID);
    expect(layoutRequest).toContain("AI 语义重排当前画布");
    expect(layoutRequest).not.toContain("此前的普通对话");
    expect(layoutRequest).not.toContain("read_nodes 批量读取");
  });
});
