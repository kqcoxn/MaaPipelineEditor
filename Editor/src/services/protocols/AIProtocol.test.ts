import { afterEach, describe, expect, it, vi } from "vitest";
import type { LocalWebSocketServer } from "../server";
import { AIProtocol, type AIProxyRequest } from "./AIProtocol";

type RouteHandler = (data: unknown) => void;

class FakeWebSocketServer {
  readonly sent: Array<{ path: string; data: Record<string, unknown> }> = [];
  private readonly routes = new Map<string, RouteHandler>();
  private statusHandler: ((connected: boolean) => void) | undefined;

  onStatus(handler: (connected: boolean) => void): () => void {
    this.statusHandler = handler;
    return () => {
      this.statusHandler = undefined;
    };
  }

  registerRoute(path: string, handler: RouteHandler): void {
    this.routes.set(path, handler);
  }

  send(path: string, data: Record<string, unknown>): boolean {
    this.sent.push({ path, data });
    return true;
  }

  deliver(path: string, data: Record<string, unknown>): void {
    this.routes.get(path)?.(data);
  }

  disconnect(): void {
    this.statusHandler?.(false);
  }
}

const request: AIProxyRequest = {
  url: "https://example.com/v1/chat/completions",
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
};
const REQUEST_TIMEOUT_MS = 600_000;

function createProtocol() {
  const server = new FakeWebSocketServer();
  const protocol = new AIProtocol();
  protocol.register(server as unknown as LocalWebSocketServer);
  return { protocol, server };
}

function getRequestId(server: FakeWebSocketServer): string {
  const requestID = server.sent[0]?.data.request_id;
  if (typeof requestID !== "string") {
    throw new Error("测试请求未发送 request_id");
  }
  return requestID;
}

describe("AIProtocol", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves a normal response and preserves its payload", async () => {
    const { protocol, server } = createProtocol();
    const responsePromise = protocol.sendProxyRequest(
      request,
      REQUEST_TIMEOUT_MS,
    );
    const requestID = getRequestId(server);

    server.deliver("/lte/ai/proxy_response", {
      request_id: requestID,
      status: 201,
      headers: { "content-type": "application/json" },
      body: "{\"ok\":true}",
    });

    await expect(responsePromise).resolves.toEqual({
      status: 201,
      headers: { "content-type": "application/json" },
      body: "{\"ok\":true}",
    });
  });

  it("cancels a pending normal request through AbortSignal", async () => {
    const { protocol, server } = createProtocol();
    const abortController = new AbortController();
    const responsePromise = protocol.sendProxyRequest(
      request,
      REQUEST_TIMEOUT_MS,
      abortController.signal,
    );

    abortController.abort();

    await expect(responsePromise).rejects.toMatchObject({ name: "AbortError" });
    expect(server.sent.at(-1)).toMatchObject({
      path: "/etl/ai/proxy_cancel",
    });
  });

  it("times out a pending normal request and sends cancellation", async () => {
    vi.useFakeTimers();
    const { protocol, server } = createProtocol();
    const responsePromise = protocol.sendProxyRequest(
      request,
      REQUEST_TIMEOUT_MS,
    );
    const rejection = expect(responsePromise).rejects.toThrow("代理请求超时");

    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);

    await rejection;
    expect(server.sent.at(-1)).toMatchObject({
      path: "/etl/ai/proxy_cancel",
    });
  });

  it("forwards stream chunks and closes on done", async () => {
    const { protocol, server } = createProtocol();
    const { stream, requestId } = protocol.sendStreamProxyRequest(
      request,
      REQUEST_TIMEOUT_MS,
    );
    const reader = stream.getReader();

    server.deliver("/lte/ai/proxy_stream", {
      request_id: requestId,
      chunk: "data: hello\n\n",
    });
    await expect(reader.read()).resolves.toEqual({
      done: false,
      value: new TextEncoder().encode("data: hello\n\n"),
    });

    server.deliver("/lte/ai/proxy_stream", {
      request_id: requestId,
      done: true,
    });
    await expect(reader.read()).resolves.toEqual({
      done: true,
      value: undefined,
    });
  });

  it("cancels the backend when a stream reader is cancelled", async () => {
    const { protocol, server } = createProtocol();
    const { stream } = protocol.sendStreamProxyRequest(
      request,
      REQUEST_TIMEOUT_MS,
    );
    const reader = stream.getReader();

    await reader.cancel();

    expect(server.sent.at(-1)).toMatchObject({
      path: "/etl/ai/proxy_cancel",
    });
  });

  it("propagates stream errors to the reader", async () => {
    const { protocol, server } = createProtocol();
    const { stream, requestId } = protocol.sendStreamProxyRequest(
      request,
      REQUEST_TIMEOUT_MS,
    );
    const reader = stream.getReader();

    server.deliver("/lte/ai/proxy_stream", {
      request_id: requestId,
      error: "upstream failed",
    });

    await expect(reader.read()).rejects.toThrow("upstream failed");
  });

  it("rejects pending requests when the WebSocket disconnects", async () => {
    const { protocol, server } = createProtocol();
    const responsePromise = protocol.sendProxyRequest(
      request,
      REQUEST_TIMEOUT_MS,
    );

    server.disconnect();

    await expect(responsePromise).rejects.toThrow("WebSocket 已断开");
  });

  it("forwards the configured timeout to LocalBridge", async () => {
    const { protocol, server } = createProtocol();
    const { stream } = protocol.sendStreamProxyRequest(
      request,
      REQUEST_TIMEOUT_MS,
    );

    expect(server.sent[0]).toMatchObject({
      path: "/etl/ai/proxy_stream",
      data: { timeout_ms: REQUEST_TIMEOUT_MS },
    });
    await stream.cancel();
  });
});
