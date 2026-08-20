import type { LocalWebSocketServer } from "../server";
import { BaseProtocol } from "./BaseProtocol";

/** AI 代理请求。请求体由 Provider 负责构建，协议层只负责传输。 */
export interface AIProxyRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

interface AIProxyResponseData {
  request_id?: string;
  status?: number;
  headers?: Record<string, string>;
  body?: string;
  chunk?: string;
  error?: string;
  done?: boolean;
}

function createRequestId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function createAbortError(): Error {
  const error = new Error("请求已取消");
  error.name = "AbortError";
  return error;
}

/**
 * AI 代理协议。
 * 负责 WebSocket 请求生命周期，不负责 Provider 格式和业务提示词。
 */
export class AIProtocol extends BaseProtocol {
  private responseHandlers = new Map<
    string,
    (data: AIProxyResponseData) => void
  >();
  private streamHandlers = new Map<
    string,
    (data: AIProxyResponseData) => void
  >();
  private statusUnsubscribe: (() => void) | null = null;

  getName(): string {
    return "AIProtocol";
  }

  getVersion(): string {
    return "1.0.0";
  }

  register(wsClient: LocalWebSocketServer): void {
    this.wsClient = wsClient;

    this.statusUnsubscribe?.();
    this.statusUnsubscribe = wsClient.onStatus((connected) => {
      if (!connected) {
        this.rejectPending(
          this.responseHandlers,
          new Error("WebSocket 已断开"),
        );
        this.rejectPending(this.streamHandlers, new Error("WebSocket 已断开"));
      }
    });

    wsClient.registerRoute("/lte/ai/proxy_response", (data) => {
      this.handleMessage("/lte/ai/proxy_response", data);
    });
    wsClient.registerRoute("/lte/ai/proxy_stream", (data) => {
      this.handleMessage("/lte/ai/proxy_stream", data);
    });
  }

  unregister(): void {
    this.statusUnsubscribe?.();
    this.statusUnsubscribe = null;
    this.rejectPending(this.responseHandlers, new Error("WebSocket 已断开"));
    this.rejectPending(this.streamHandlers, new Error("WebSocket 已断开"));
    super.unregister();
  }

  protected handleMessage(path: string, data: AIProxyResponseData): void {
    const requestId = data?.request_id;
    if (!requestId) return;

    if (path === "/lte/ai/proxy_response") {
      const handler = this.responseHandlers.get(requestId);
      if (!handler) return;
      handler(data);
      this.responseHandlers.delete(requestId);
      return;
    }

    if (path === "/lte/ai/proxy_stream") {
      const handler = this.streamHandlers.get(requestId);
      if (!handler) return;
      handler(data);
      if (data.done || data.error) {
        this.streamHandlers.delete(requestId);
      }
    }
  }

  /** 发送非流式代理请求。 */
  sendProxyRequest(
    request: AIProxyRequest,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<{
    status: number;
    headers: Record<string, string>;
    body: string;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.wsClient) {
        reject(new Error("WebSocket 未连接"));
        return;
      }

      const requestId = createRequestId();
      let settled = false;

      const cleanup = () => {
        clearTimeout(timeout);
        this.responseHandlers.delete(requestId);
        signal?.removeEventListener("abort", handleAbort);
      };

      const handleAbort = () => {
        if (settled) return;
        settled = true;
        cleanup();
        this.cancelProxyRequest(requestId);
        reject(createAbortError());
      };

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        this.cancelProxyRequest(requestId);
        reject(
          new Error(`代理请求超时（${Math.round(timeoutMs / 1000)}s）`),
        );
      }, timeoutMs);

      if (signal?.aborted) {
        handleAbort();
        return;
      }

      this.responseHandlers.set(requestId, (data) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (data.error) {
          reject(new Error(data.error));
          return;
        }
        resolve({
          status: data.status ?? 200,
          headers: data.headers ?? {},
          body: data.body ?? "",
        });
      });
      signal?.addEventListener("abort", handleAbort, { once: true });

      const success = this.wsClient.send("/etl/ai/proxy", {
        request_id: requestId,
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: request.body,
        timeout_ms: timeoutMs,
      });

      if (!success && !settled) {
        settled = true;
        cleanup();
        reject(new Error("代理请求发送失败，本地服务未连接"));
      }
    });
  }

  /** 发送流式代理请求，ReadableStream 的 cancel 会取消后端请求。 */
  sendStreamProxyRequest(
    request: AIProxyRequest,
    timeoutMs: number,
    signal?: AbortSignal,
  ): { stream: ReadableStream<Uint8Array>; requestId: string } {
    const requestId = createRequestId();
    const encoder = new TextEncoder();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;

    const cleanup = (cancelRemote: boolean) => {
      if (closed) return;
      closed = true;
      if (timeout) clearTimeout(timeout);
      this.streamHandlers.delete(requestId);
      signal?.removeEventListener("abort", handleAbort);
      if (cancelRemote) this.cancelProxyRequest(requestId);
    };

    const handleAbort = () => {
      if (closed) return;
      cleanup(true);
      controller?.error(createAbortError());
    };

    const stream = new ReadableStream<Uint8Array>({
      start: (streamController) => {
        controller = streamController;

        if (!this.wsClient) {
          cleanup(false);
          streamController.error(new Error("WebSocket 未连接"));
          return;
        }
        if (signal?.aborted) {
          handleAbort();
          return;
        }

        this.streamHandlers.set(requestId, (data) => {
          if (closed) return;
          if (data.error) {
            cleanup(false);
            streamController.error(new Error(data.error));
            return;
          }
          if (data.chunk) {
            streamController.enqueue(encoder.encode(data.chunk));
          }
          if (data.done) {
            cleanup(false);
            streamController.close();
          }
        });
        signal?.addEventListener("abort", handleAbort, { once: true });
        timeout = setTimeout(() => {
          if (closed) return;
          cleanup(true);
          streamController.error(
            new Error(
              `流式代理请求超时（${Math.round(timeoutMs / 1000)}s）`,
            ),
          );
        }, timeoutMs);

        const success = this.wsClient.send("/etl/ai/proxy_stream", {
          request_id: requestId,
          url: request.url,
          method: request.method,
          headers: request.headers,
          body: request.body,
          timeout_ms: timeoutMs,
        });
        if (!success) {
          cleanup(false);
          streamController.error(new Error("流式代理请求发送失败"));
        }
      },
      cancel: () => {
        cleanup(true);
      },
    });

    return { stream, requestId };
  }

  private cancelProxyRequest(requestId: string): void {
    this.wsClient?.send("/etl/ai/proxy_cancel", { request_id: requestId });
  }

  private rejectPending(
    handlers: Map<string, (data: AIProxyResponseData) => void>,
    error: Error,
  ): void {
    for (const handler of handlers.values()) {
      handler({ error: error.message });
    }
    handlers.clear();
  }
}
