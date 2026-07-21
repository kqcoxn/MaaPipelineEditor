import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configs: {
    aiProviderType: "custom",
    aiApiUrl: "https://example.test/v1",
    aiApiKey: "secret",
    aiModel: "test-model",
    aiTemperature: 0.2,
    aiUseProxy: false,
  },
  isConnected: vi.fn(() => false),
  sendProxyRequest: vi.fn(),
  sendStreamProxyRequest: vi.fn(),
}));

vi.mock("../../stores/configStore", () => ({
  useConfigStore: {
    getState: () => ({ configs: mocks.configs }),
  },
}));

vi.mock("../../services/server", () => ({
  localServer: { isConnected: mocks.isConnected },
  aiProtocol: {
    sendProxyRequest: mocks.sendProxyRequest,
    sendStreamProxyRequest: mocks.sendStreamProxyRequest,
  },
}));

vi.mock("./crypto", () => ({
  decryptApiKey: (value: string) => Promise.resolve(value),
}));

import { AIClient } from "./aiClient";
import type { UnifiedMessage } from "./providers";

const messages: UnifiedMessage[] = [{ role: "user", content: "hello" }];

afterEach(() => {
  mocks.configs.aiApiUrl = "https://example.test/v1";
  mocks.configs.aiApiKey = "secret";
  mocks.configs.aiModel = "test-model";
  mocks.configs.aiUseProxy = false;
  mocks.isConnected.mockReturnValue(false);
  mocks.sendProxyRequest.mockReset();
  mocks.sendStreamProxyRequest.mockReset();
  vi.unstubAllGlobals();
});

describe("AIClient", () => {
  it("sends only the messages provided for each completion", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "done" } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new AIClient({ retryCount: 0 });

    await client.complete(messages);
    await client.complete(messages);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, request] of fetchMock.mock.calls) {
      const body = JSON.parse(request.body as string) as { messages: unknown[] };
      expect(body.messages).toHaveLength(1);
    }
  });

  it("validates required configuration before requesting", async () => {
    mocks.configs.aiApiKey = "";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(new AIClient().complete(messages)).resolves.toEqual({
      success: false,
      content: "",
      error: "API Key 未配置",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses LocalBridge for proxied completions", async () => {
    mocks.configs.aiUseProxy = true;
    mocks.isConnected.mockReturnValue(true);
    mocks.sendProxyRequest.mockResolvedValue({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ choices: [{ message: { content: "proxied" } }] }),
    });

    const result = await new AIClient({ retryCount: 0 }).complete(messages);

    expect(result.success).toBe(true);
    expect(result.content).toBe("proxied");
    expect(mocks.sendProxyRequest).toHaveBeenCalledOnce();
  });

  it("retries transient completion failures", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ choices: [{ message: { content: "retried" } }] }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new AIClient({
      retryCount: 1,
      retryDelay: 0,
    }).complete(messages);

    expect(result.content).toBe("retried");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("cancels a proxied completion through an external signal", async () => {
    mocks.configs.aiUseProxy = true;
    mocks.isConnected.mockReturnValue(true);
    mocks.sendProxyRequest.mockImplementation(
      (_request: unknown, signal?: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    );
    const controller = new AbortController();
    const pendingResult = new AIClient({ retryCount: 0 }).complete(messages, {
      signal: controller.signal,
    });

    await vi.waitFor(() => {
      expect(mocks.sendProxyRequest).toHaveBeenCalledOnce();
    });
    controller.abort();

    await expect(pendingResult).resolves.toEqual({
      success: false,
      content: "",
      error: "请求已取消",
    });
  });

  it("streams proxy chunks through the provider parser", async () => {
    mocks.configs.aiUseProxy = true;
    mocks.isConnected.mockReturnValue(true);
    const encoder = new TextEncoder();
    mocks.sendStreamProxyRequest.mockReturnValue({
      requestId: "request-1",
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode('data: {"choices":[{"delta":{"content":"pa'),
          );
          controller.enqueue(
            encoder.encode('rt"}}]}\ndata: [DONE]\n'),
          );
          controller.close();
        },
      }),
    });
    const chunks: Array<[string, boolean]> = [];

    const result = await new AIClient({ retryCount: 0 }).stream(
      messages,
      (chunk, done) => chunks.push([chunk, done]),
    );

    expect(result.content).toBe("part");
    expect(chunks).toEqual([
      ["part", false],
      ["", true],
    ]);
    expect(mocks.sendStreamProxyRequest).toHaveBeenCalledOnce();
  });

  it("does not retry a stream after delivering content", async () => {
    mocks.configs.aiUseProxy = true;
    mocks.isConnected.mockReturnValue(true);
    const encoder = new TextEncoder();
    mocks.sendStreamProxyRequest.mockReturnValue({
      requestId: "request-2",
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"part"}}]}\n',
            ),
          );
          setTimeout(() => controller.error(new Error("stream failed")), 0);
        },
      }),
    });
    const chunks: string[] = [];

    const result = await new AIClient({ retryCount: 1, retryDelay: 0 }).stream(
      messages,
      (chunk) => {
        if (chunk) chunks.push(chunk);
      },
    );

    expect(result).toEqual({
      success: false,
      content: "",
      error: "stream failed",
    });
    expect(chunks).toEqual(["part"]);
    expect(mocks.sendStreamProxyRequest).toHaveBeenCalledOnce();
  });
});
