import { describe, expect, it } from "vitest";
import { evaluateCompletion } from "./completionEvaluator";

describe("evaluateCompletion", () => {
  it("不会被带工具调用的模型文本绕过", () => {
    expect(
      evaluateCompletion(
        {
          success: true,
          content: "已经完成",
          finishReason: "tool_calls",
          toolCalls: [{ id: "1", name: "create_node", arguments: {} }],
        },
        [],
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
        [],
      ),
    ).toMatchObject({ complete: true, status: "succeeded" });
  });
});
