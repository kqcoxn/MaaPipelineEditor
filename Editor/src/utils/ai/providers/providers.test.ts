import { describe, expect, it } from "vitest";
import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import {
  openaiProvider,
  resolveOpenAICompatibleChatUrl,
} from "./openai";
import type { AIProviderConfig, UnifiedMessage } from "./types";

const messages: UnifiedMessage[] = [
  { role: "user", content: "hello" },
];
const tools = [
  {
    name: "read_canvas",
    description: "读取画布",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

const config: AIProviderConfig = {
  type: "openai",
  apiUrl: "https://api.example.com",
  apiKey: "test-key",
  model: "test-model",
  temperature: 0.7,
};

describe("OpenAI provider", () => {
  it("resolves base, versioned, and complete endpoint URLs", () => {
    expect(resolveOpenAICompatibleChatUrl("https://api.example.com")).toBe(
      "https://api.example.com/v1/chat/completions",
    );
    expect(
      resolveOpenAICompatibleChatUrl("https://api.example.com/v1/"),
    ).toBe("https://api.example.com/v1/chat/completions");
    expect(
      resolveOpenAICompatibleChatUrl(
        "https://api.example.com/custom/chat/completions",
      ),
    ).toBe("https://api.example.com/custom/chat/completions");
  });

  it("marks both the request and body as streaming", () => {
    const request = openaiProvider.buildRequest(messages, config, {
      stream: true,
    });
    const body = JSON.parse(request.body) as {
      stream: boolean;
      stream_options: { include_usage: boolean };
    };

    expect(request.stream).toBe(true);
    expect(body.stream).toBe(true);
    expect(body.stream_options.include_usage).toEqual(true);
  });

  it("serializes and parses native tool calls", () => {
    const request = openaiProvider.buildRequest(messages, config, { tools });
    const body = JSON.parse(request.body);
    expect(body.tools[0].function.name).toBe("read_canvas");
    expect(body.tools[0].function.strict).toBe(true);

    expect(
      openaiProvider.parseResponse({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: "",
              tool_calls: [
                {
                  id: "call-1",
                  function: { name: "read_canvas", arguments: "{}" },
                },
              ],
            },
          },
        ],
      }),
    ).toMatchObject({
      toolCalls: [{ id: "call-1", name: "read_canvas", arguments: {} }],
      finishReason: "tool_calls",
    });
  });

  it("parses OpenAI-compatible reasoning from stream and response", () => {
    expect(
      openaiProvider.parseStreamEvent?.({
        data: JSON.stringify({
          choices: [{ delta: { reasoning_content: "分析中" } }],
        }),
      }),
    ).toMatchObject({ reasoning: "分析中" });
    expect(
      openaiProvider.parseResponse({
        choices: [
          {
            message: { content: "回答", reasoning_content: "分析完成" },
            finish_reason: "stop",
          },
        ],
      }),
    ).toMatchObject({ content: "回答", reasoning: "分析完成" });
  });
});

describe("Anthropic and Gemini providers", () => {
  it("propagates the stream flag to both providers", () => {
    const anthropicRequest = anthropicProvider.buildRequest(
      messages,
      { ...config, type: "anthropic", apiUrl: "https://api.anthropic.com" },
      { stream: true },
    );
    const geminiRequest = geminiProvider.buildRequest(
      messages,
      {
        ...config,
        type: "gemini",
        apiUrl: "https://generativelanguage.googleapis.com",
      },
      { stream: true },
    );

    expect(anthropicRequest.stream).toBe(true);
    expect(JSON.parse(anthropicRequest.body).stream).toBe(true);
    expect(geminiRequest.stream).toBe(true);
    expect(geminiRequest.url).toContain(":streamGenerateContent?alt=sse");
  });

  it("maps native Anthropic and Gemini tool schemas", () => {
    const anthropicBody = JSON.parse(
      anthropicProvider.buildRequest(
        messages,
        { ...config, type: "anthropic" },
        { tools },
      ).body,
    );
    const geminiBody = JSON.parse(
      geminiProvider.buildRequest(
        messages,
        { ...config, type: "gemini" },
        { tools },
      ).body,
    );

    expect(anthropicBody.tools[0].input_schema).toEqual(tools[0].inputSchema);
    expect(geminiBody.tools[0].functionDeclarations[0].name).toBe(
      "read_canvas",
    );
  });

  it("preserves every system rule for Anthropic and Gemini", () => {
    const systemMessages: UnifiedMessage[] = [
      { role: "system", content: "系统规则" },
      { role: "system", content: "MPE 安全规则" },
      { role: "user", content: "hello" },
    ];
    const anthropicBody = JSON.parse(
      anthropicProvider.buildRequest(systemMessages, {
        ...config,
        type: "anthropic",
      }).body,
    );
    const geminiBody = JSON.parse(
      geminiProvider.buildRequest(systemMessages, {
        ...config,
        type: "gemini",
      }).body,
    );

    expect(anthropicBody.system).toContain("系统规则\n\nMPE 安全规则");
    expect(geminiBody.systemInstruction.parts[0].text).toContain(
      "系统规则\n\nMPE 安全规则",
    );
  });

  it("merges Anthropic usage from message_start and message_delta", () => {
    const startUsage = anthropicProvider.parseStreamUsage?.({
      type: "message_start",
      message: { usage: { input_tokens: 12, output_tokens: 1 } },
    });
    const deltaUsage = anthropicProvider.parseStreamUsage?.({
      type: "message_delta",
      usage: { output_tokens: 20 },
    });

    expect(startUsage).toEqual({
      promptTokens: 12,
      completionTokens: 1,
      totalTokens: 13,
      isEstimated: false,
    });
    expect(
      anthropicProvider.mergeStreamUsage?.(startUsage, deltaUsage!),
    ).toEqual({
      promptTokens: 12,
      completionTokens: 20,
      totalTokens: 32,
      isEstimated: false,
    });
  });

  it("separates Anthropic and Gemini reasoning from answer text", () => {
    expect(
      anthropicProvider.parseStreamEvent?.({
        event: "content_block_delta",
        data: JSON.stringify({
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "Anthropic 思考" },
        }),
      }),
    ).toMatchObject({ reasoning: "Anthropic 思考" });

    expect(
      geminiProvider.parseStreamEvent?.({
        data: JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { text: "Gemini 思考", thought: true },
                  { text: "Gemini 回答" },
                ],
              },
            },
          ],
        }),
      }),
    ).toMatchObject({
      reasoning: "Gemini 思考",
      content: "Gemini 回答",
    });
  });
});
