import { describe, expect, it, vi } from "vitest";
import { HarnessModelAdapter } from "./modelAdapter";

const tools = [
  {
    name: "read_canvas",
    description: "读取画布",
    inputSchema: {
      type: "object",
      properties: { detail: { type: "boolean" } },
      required: ["detail"],
      additionalProperties: false,
    },
  },
];

describe("HarnessModelAdapter JSON Envelope", () => {
  const adapter = new HarnessModelAdapter({} as never);

  it("解析严格工具 Envelope", () => {
    const result = adapter.parseEnvelope(
      '{"type":"tool_calls","calls":[{"name":"read_canvas","arguments":{"detail":true}}]}',
      tools,
    );
    expect(result).toMatchObject({
      success: true,
      finishReason: "tool_calls",
      toolCalls: [{ name: "read_canvas", arguments: { detail: true } }],
    });
  });

  it("兼容 Markdown JSON 代码围栏", () => {
    const result = adapter.parseEnvelope(
      '```json\n{"type":"final","content":"完成"}\n```',
      tools,
    );

    expect(result).toMatchObject({
      success: true,
      content: "完成",
      finishReason: "stop",
    });
  });

  it.each([
    ["非法工具", '{"type":"tool_calls","calls":[{"name":"shell","arguments":{}}]}'],
    ["非法参数", '{"type":"tool_calls","calls":[{"name":"read_canvas","arguments":{}}]}'],
    ["多余字段", '{"type":"final","content":"ok","extra":true}'],
  ])("拒绝%s", (_label, envelope) => {
    expect(adapter.parseEnvelope(envelope, tools).success).toBe(false);
  });

  it("自定义 Provider 原生工具不兼容时回退到严格 Envelope", async () => {
    const client = {
      getModelConfigSnapshot: vi.fn(async () => ({ type: "custom" })),
      complete: vi
        .fn()
        .mockResolvedValueOnce({
          success: false,
          content: "",
          error: "HTTP 400: tools unsupported",
          toolCalls: [],
          finishReason: "error",
        })
        .mockResolvedValueOnce({
          success: true,
          content:
            '{"type":"tool_calls","calls":[{"name":"read_canvas","arguments":{"detail":true}}]}',
          toolCalls: [],
          finishReason: "stop",
        }),
    };

    const result = await new HarnessModelAdapter(client as never).complete(
      [{ role: "user", content: "读取" }],
      tools,
    );

    expect(client.complete).toHaveBeenCalledTimes(2);
    expect(result.finishReason).toBe("tool_calls");
  });

  it("原生工具调用缺少名称时回退到严格 Envelope", async () => {
    const client = {
      getModelConfigSnapshot: vi.fn(async () => ({ type: "openai" })),
      complete: vi
        .fn()
        .mockResolvedValueOnce({
          success: true,
          content: "先读取画布。",
          reasoning: "需要先确认节点",
          toolCalls: [{ id: "empty", name: "", arguments: {} }],
          finishReason: "tool_calls",
        })
        .mockResolvedValueOnce({
          success: true,
          content:
            '{"type":"tool_calls","calls":[{"name":"read_canvas","arguments":{"detail":true}}]}',
          toolCalls: [],
          finishReason: "stop",
        }),
    };

    const result = await new HarnessModelAdapter(client as never).complete(
      [{ role: "user", content: "读取" }],
      tools,
    );

    expect(client.complete).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      success: true,
      content: "先读取画布。",
      reasoning: "需要先确认节点",
      toolCalls: [{ name: "read_canvas", arguments: { detail: true } }],
    });
    expect(client.complete.mock.calls[1][0][0].content).toContain(
      "read_canvas",
    );
    expect(client.complete.mock.calls[1][0][0].content).toContain(
      "输入 Schema",
    );
  });

  it("Envelope 格式错误时自动请求模型纠正一次", async () => {
    const client = {
      getModelConfigSnapshot: vi.fn(async () => ({ type: "openai" })),
      complete: vi
        .fn()
        .mockResolvedValueOnce({
          success: true,
          content: "准备读取。",
          toolCalls: [{ id: "empty", name: "", arguments: {} }],
          finishReason: "tool_calls",
        })
        .mockResolvedValueOnce({
          success: true,
          content: "这不是 JSON",
          toolCalls: [],
          finishReason: "stop",
        })
        .mockResolvedValueOnce({
          success: true,
          content:
            '{"type":"tool_calls","calls":[{"name":"read_canvas","arguments":{"detail":true}}]}',
          toolCalls: [],
          finishReason: "stop",
        }),
    };

    const result = await new HarnessModelAdapter(client as never).complete(
      [{ role: "user", content: "读取" }],
      tools,
    );

    expect(client.complete).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({
      success: true,
      content: "准备读取。",
      toolCalls: [{ name: "read_canvas", arguments: { detail: true } }],
    });
    expect(client.complete.mock.calls[2][0].at(-1)?.content).toContain(
      "上一个 JSON Envelope 无效",
    );
  });
});
