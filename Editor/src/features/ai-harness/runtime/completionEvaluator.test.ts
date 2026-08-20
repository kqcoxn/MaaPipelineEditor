import { describe, expect, it } from "vitest";
import { evaluateCompletion } from "./completionEvaluator";

describe("evaluateCompletion", () => {
  const successfulToolResult = {
    ok: true,
    stateVersion: 1,
  };

  it("不会被带工具调用的模型文本绕过", () => {
    expect(
      evaluateCompletion(
        {
          success: true,
          content: "已经完成",
          finishReason: "tool_calls",
          toolCalls: [{ id: "1", name: "create_node", arguments: {} }],
        },
        { toolResults: [] },
      ),
    ).toEqual({ complete: false });
  });

  it("仅在没有待执行工具且存在最终文本时成功", () => {
    expect(
      evaluateCompletion(
        {
          success: true,
          content: "画布查询完成",
          finishReason: "stop",
          toolCalls: [],
        },
        { toolResults: [successfulToolResult] },
      ),
    ).toMatchObject({ complete: true, status: "succeeded" });
  });

  it("纯对话未调用工具时接受有效最终文本", () => {
    expect(
      evaluateCompletion(
        {
          success: true,
          content: "你好，有什么可以帮你？",
          finishReason: "stop",
          toolCalls: [],
        },
        { toolResults: [] },
      ),
    ).toEqual({ complete: true, status: "succeeded" });
  });

  it("拒绝未恢复的工具错误和未通过校验的画布变更", () => {
    const response = {
      success: true,
      content: "已经完成",
      finishReason: "stop" as const,
      toolCalls: [],
    };

    expect(
      evaluateCompletion(response, {
        toolResults: [
          {
            ok: false,
            stateVersion: 1,
            error: {
              code: "state_conflict",
              message: "版本冲突",
              retryable: true,
            },
          },
        ],
      }),
    ).toMatchObject({ complete: true, status: "failed" });

    expect(
      evaluateCompletion(response, {
        toolResults: [{ ...successfulToolResult, undoable: true }],
        changedCanvas: true,
        canvasValidation: {
          ok: false,
          stateVersion: 2,
          validationErrors: ["节点非法"],
        },
      }),
    ).toMatchObject({ complete: true, status: "failed" });
  });
});
