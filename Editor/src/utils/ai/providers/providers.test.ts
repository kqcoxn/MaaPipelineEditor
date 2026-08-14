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
});
