import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const configStoreMock = vi.hoisted(() => ({
  getState: vi.fn(),
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

vi.mock("@/stores/app/configStore", () => ({
  useConfigStore: configStoreMock,
  normalizeAIRequestTimeoutMs: (value: number) =>
    Number.isFinite(value) ? value * 60_000 : 600_000,
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
  aiRequestTimeoutMinutes: 10,
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

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("times out one model request without reporting user cancellation", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        }),
      ),
    );
    const client = new AIClient({ retryCount: 0, requestTimeoutMs: 1_000 });
    const requestPromise = client.complete(
      [{ role: "user", content: "wait" }],
      { stream: false },
    );

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(requestPromise).resolves.toMatchObject({
      success: false,
      error: "模型请求超时（1s）",
      finishReason: "error",
    });
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
    expect(serverMock.aiProtocol.sendStreamProxyRequest).toHaveBeenCalledWith(
      expect.any(Object),
      600_000,
      expect.any(AbortSignal),
    );
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

  it("keeps basic non-stream requests available without business history", async () => {
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
  });

  it("stitches streamed native tool-call arguments", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const stream = createResponseStream([
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-1","function":{"name":"create_node","arguments":"{\\"name\\":"}}]}}]}\n\n',
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"结束\\",\\"expectedStateVersion\\":1}"}}]},"finish_reason":"tool_calls"}]}\n\n',
          "data: [DONE]\n\n",
        ]);
        return new Response(stream, { status: 200 });
      }),
    );

    const result = await new AIClient({ retryCount: 0 }).complete(
      [{ role: "user", content: "创建结束节点" }],
      {
        tools: [
          {
            name: "create_node",
            description: "创建节点",
            inputSchema: { type: "object" },
          },
        ],
      },
    );

    expect(result).toMatchObject({
      success: true,
      finishReason: "tool_calls",
      toolCalls: [
        {
          id: "call-1",
          name: "create_node",
          arguments: { name: "结束", expectedStateVersion: 1 },
        },
      ],
    });
  });

  it("streams reasoning separately from answer content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          createResponseStream([
            'data: {"choices":[{"delta":{"reasoning_content":"先分析"}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"再回答"},"finish_reason":"stop"}]}\n\n',
            "data: [DONE]\n\n",
          ]),
          { status: 200 },
        ),
      ),
    );
    const textChunks: string[] = [];
    const reasoningChunks: string[] = [];

    const result = await new AIClient({ retryCount: 0 }).complete(
      [{ role: "user", content: "分析" }],
      {},
      (delta) => textChunks.push(delta),
      (delta) => reasoningChunks.push(delta),
    );

    expect(result).toMatchObject({
      content: "再回答",
      reasoning: "先分析",
    });
    expect(textChunks).toEqual(["再回答"]);
    expect(reasoningChunks).toEqual(["先分析"]);
  });

  it("freezes model configuration for every request in a Harness Run", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: "answer" } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new AIClient({ retryCount: 0 });

    const snapshot = await client.freezeModelConfig();
    configStoreMock.getState.mockReturnValue({
      configs: {
        ...config,
        aiApiUrl: "https://changed.example.com",
        aiModel: "changed-model",
      },
    });
    await client.complete([{ role: "user", content: "hello" }], {
      stream: false,
    });

    expect(snapshot).toMatchObject({
      apiUrl: config.aiApiUrl,
      model: config.aiModel,
    });
    expect(fetchMock.mock.calls[0][0]).toContain("api.example.com");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).model).toBe(
      "test-model",
    );
  });
});
