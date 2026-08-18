import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UnifiedMessage, UnifiedResponse } from "@/utils/ai/providers";

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

vi.mock("./canvasCommandBus", () => ({
  canvasCommandBus: canvasMock,
}));

import { HarnessRunner } from "./runner";
import { useAIHarnessStore } from "./store";

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
    const runner = new HarnessRunner();

    const runId = await runner.start("读取当前节点");
    const run = await waitForRun(runId);

    expect(run.status).toBe("succeeded");
    expect(run.toolCallCount).toBe(1);
    expect(useAIHarnessStore.getState().sessions[0].messages.at(-1)).toMatchObject({
      role: "assistant",
      content: "读取完成",
    });
  });

  it("工具权限错误后不能由最终文本伪装成功", async () => {
    modelMock.complete
      .mockResolvedValueOnce({
        ...readToolResponse(),
        toolCalls: [{ id: "bad", name: "shell", arguments: {} }],
      })
      .mockResolvedValueOnce(finalResponse());
    const runner = new HarnessRunner();

    const run = await waitForRun(await runner.start("执行非法工具"));

    expect(run.status).toBe("failed");
    expect(run.error).toContain("权限");
  });

  it("达到 Token、Turn 和工具次数预算后终止", async () => {
    modelMock.complete.mockResolvedValueOnce({
      ...finalResponse(),
      usage: {
        promptTokens: 32_001,
        completionTokens: 1,
        totalTokens: 32_002,
        isEstimated: false,
      },
    });
    let runner = new HarnessRunner();
    let run = await waitForRun(await runner.start("超出 Token"));
    expect(run.error).toContain("Token");

    modelMock.complete.mockImplementation(async () =>
      readToolResponse(String(modelMock.complete.mock.calls.length)),
    );
    runner = new HarnessRunner();
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
    runner = new HarnessRunner();
    run = await waitForRun(await runner.start("超出工具预算"));
    expect(run.error).toContain("工具调用");
    expect(run.toolCallCount).toBe(24);
  });

  it("支持用户取消和运行超时", async () => {
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
    let runner = new HarnessRunner();
    let runId = await runner.start("等待取消");
    await vi.waitFor(() => expect(modelMock.complete).toHaveBeenCalled());
    expect(runner.stop(runId)).toBe(true);
    expect((await waitForRun(runId)).status).toBe("cancelled");

    vi.useFakeTimers();
    resolveRequest = undefined;
    runner = new HarnessRunner();
    runId = await runner.start("等待超时");
    await vi.advanceTimersByTimeAsync(120_000);
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
    const runner = new HarnessRunner();
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
    const runner = new HarnessRunner();
    const firstSessionId = useAIHarnessStore.getState().activeSessionId;
    await waitForRun(await runner.start("第一会话目标", firstSessionId));
    const secondSessionId = useAIHarnessStore.getState().createSession("第二会话");
    await waitForRun(await runner.start("第二会话目标", secondSessionId));

    const secondSessionFirstRequest = capturedMessages[2]
      .map((message) => message.content)
      .join("\n");
    expect(secondSessionFirstRequest).toContain("第二会话目标");
    expect(secondSessionFirstRequest).not.toContain("第一会话目标");
  });
});
