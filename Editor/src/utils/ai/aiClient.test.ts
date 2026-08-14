import { beforeEach, describe, expect, it, vi } from "vitest";

const configStoreMock = vi.hoisted(() => ({
  getState: vi.fn(),
}));
const historyMock = vi.hoisted(() => ({
  addRecord: vi.fn(),
}));
const serverMock = vi.hoisted(() => ({
  localServer: {
    isConnected: vi.fn(),
  },
  aiProtocol: {
    sendProxyRequest: vi.fn(),
    sendStreamProxyRequest: vi.fn(),
  },
}));

vi.mock("../../stores/configStore", () => ({
  useConfigStore: configStoreMock,
}));
vi.mock("./history", () => ({
  aiHistoryManager: historyMock,
}));
vi.mock("./crypto", () => ({
  decryptApiKey: vi.fn(async (value: string) => value),
}));
vi.mock("../../services/server", () => serverMock);

import { AIClient } from "./aiClient";

const config = {
  aiApiUrl: "https://api.example.com",
  aiApiKey: "test-key",
  aiModel: "test-model",
  aiTemperature: 0.7,
  aiProviderType: "openai",
  aiUseProxy: false,
};

function createResponseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe("AIClient stream transport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configStoreMock.getState.mockReturnValue({ configs: { ...config } });
    serverMock.localServer.isConnected.mockReturnValue(true);
  });

  it("parses SSE events across transport chunk boundaries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const stream = createResponseStream([
          'data: {"choices":[{"delta":{"content":"hel',
          'lo"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
          "data: [DONE]\n\n",
        ]);
        return new Response(stream, { status: 200 });
      }),
    );

    const chunks: Array<{ content: string; done: boolean }> = [];
    const result = await new AIClient({ retryCount: 0 }).sendStream(
      "say hello",
      (content, done) => chunks.push({ content, done }),
    );

    expect(result).toEqual({ success: true, content: "hello world" });
    expect(chunks).toEqual([
      { content: "hello", done: false },
      { content: " world", done: false },
      { content: "", done: true },
    ]);
  });

  it("uses the streaming proxy protocol when proxy mode is enabled", async () => {
    configStoreMock.getState.mockReturnValue({
      configs: { ...config, aiUseProxy: true },
    });
    const stream = createResponseStream([
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
      "data: [DONE]\n\n",
    ]);
    serverMock.aiProtocol.sendStreamProxyRequest.mockReturnValue({ stream });

    const result = await new AIClient({ retryCount: 0 }).sendStream(
      "say ok",
      vi.fn(),
    );

    expect(result.success).toBe(true);
    expect(serverMock.aiProtocol.sendStreamProxyRequest).toHaveBeenCalledOnce();
    expect(serverMock.aiProtocol.sendProxyRequest).not.toHaveBeenCalled();
  });

  it("does not retry after delivering partial stream content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n',
              ),
            );
            setTimeout(() => controller.error(new Error("upstream failed")), 0);
          },
        });
        return new Response(stream, { status: 200 });
      }),
    );

    const result = await new AIClient({ retryCount: 2, retryDelay: 0 }).sendStream(
      "partial",
      vi.fn(),
    );

    expect(result.success).toBe(false);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("estimates prompt usage before adding the completion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "answer" } }],
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await new AIClient({ retryCount: 0 }).send("say hello");

    expect(result).toEqual({ success: true, content: "answer" });
    expect(historyMock.addRecord).toHaveBeenLastCalledWith(
      expect.objectContaining({
        tokenUsage: {
          promptTokens: 7,
          completionTokens: 5,
          totalTokens: 12,
          isEstimated: true,
        },
      }),
    );
  });
});
