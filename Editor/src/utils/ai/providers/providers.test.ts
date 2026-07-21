import { describe, expect, it } from "vitest";
import { anthropicProvider } from "./anthropic";
import {
  openaiProvider,
  resolveOpenAICompatibleChatUrl,
} from "./openai";
import { geminiProvider } from "./gemini";
import type { AIProviderConfig, UnifiedMessage } from "./types";

const config: AIProviderConfig = {
  type: "custom",
  apiUrl: "https://example.test/v1",
  apiKey: "secret",
  model: "test-model",
  temperature: 0.4,
};

const messages: UnifiedMessage[] = [
  { role: "system", content: "system" },
  { role: "user", content: "hello" },
];

describe("model API providers", () => {
  it("resolves OpenAI-compatible base URLs without duplicate paths", () => {
    expect(resolveOpenAICompatibleChatUrl("https://api.test")).toBe(
      "https://api.test/v1/chat/completions",
    );
    expect(
      resolveOpenAICompatibleChatUrl("https://api.test/v1/chat/completions"),
    ).toBe("https://api.test/v1/chat/completions");
  });

  it("builds an OpenAI-compatible request with image content", () => {
    const request = openaiProvider.buildRequest(messages, config, {
      stream: true,
      images: [{ base64: "abc", mimeType: "image/png" }],
    });
    const body = JSON.parse(request.body) as {
      stream: boolean;
      messages: Array<{ role: string; content: unknown }>;
    };

    expect(request.url).toBe("https://example.test/v1/chat/completions");
    expect(request.headers.Authorization).toBe("Bearer secret");
    expect(body.stream).toBe(true);
    expect(body.messages.at(-1)?.content).toEqual([
      { type: "text", text: "hello" },
      {
        type: "image_url",
        image_url: { url: "data:image/png;base64,abc" },
      },
    ]);
  });

  it("parses OpenAI, Anthropic, and Gemini response formats", () => {
    expect(
      openaiProvider.parseResponse({
        choices: [{ message: { content: "openai" } }],
        usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
      }),
    ).toEqual({
      content: "openai",
      usage: {
        promptTokens: 2,
        completionTokens: 3,
        totalTokens: 5,
        isEstimated: false,
      },
    });

    expect(
      anthropicProvider.parseResponse({
        content: [{ type: "text", text: "anthropic" }],
        usage: { input_tokens: 4, output_tokens: 6 },
      }),
    ).toEqual({
      content: "anthropic",
      usage: {
        promptTokens: 4,
        completionTokens: 6,
        totalTokens: 10,
        isEstimated: false,
      },
    });

    expect(
      geminiProvider.parseResponse({
        candidates: [{ content: { parts: [{ text: "gemini" }] } }],
        usageMetadata: {
          promptTokenCount: 1,
          candidatesTokenCount: 2,
          totalTokenCount: 3,
        },
      }),
    ).toEqual({
      content: "gemini",
      usage: {
        promptTokens: 1,
        completionTokens: 2,
        totalTokens: 3,
        isEstimated: false,
      },
    });
  });

  it("parses SSE chunks and end markers", () => {
    expect(
      openaiProvider.parseStreamChunk('data: {"choices":[{"delta":{"content":"a"}}]}'),
    ).toBe("a");
    expect(openaiProvider.parseStreamChunk("data: [DONE]")).toBeNull();
    expect(
      anthropicProvider.parseStreamChunk(
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"b"}}',
      ),
    ).toBe("b");
    expect(anthropicProvider.parseStreamChunk("event: message_stop")).toBeNull();
    expect(
      geminiProvider.parseStreamChunk(
        'data: {"candidates":[{"content":{"parts":[{"text":"c"}]}}]}',
      ),
    ).toBe("c");
  });
});
