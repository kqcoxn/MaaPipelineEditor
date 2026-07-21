import type { LocalWebSocketServer } from "../server";
import { BaseProtocol } from "./BaseProtocol";

/**
 * 模型 API 代理协议
 * 通过 LocalBridge 转发模型 API 请求，解决 CORS 限制
 */
export class AIProtocol extends BaseProtocol {
  private responseHandlers: Map<string, (data: any) => void> = new Map();
  private streamHandlers: Map<string, (data: any) => void> = new Map();

  getName(): string {
    return "AIProtocol";
  }

  getVersion(): string {
    return "1.0.0";
  }

  register(wsClient: LocalWebSocketServer): void {
    this.wsClient = wsClient;

    // 注册代理响应路由
    wsClient.registerRoute("ai.response", (data) => {
      this.handleMessage("ai.response", data);
    });

    // 注册流式代理响应路由
    wsClient.registerRoute("ai.streamChunk", (data) => {
      this.handleMessage("ai.streamChunk", data);
    });
  }

  protected handleMessage(path: string, data: any): void {
    const requestId = data?.request_id || "default";

    switch (path) {
      case "ai.response": {
        const handler = this.responseHandlers.get(requestId);
        if (handler) {
          handler(data);
          this.responseHandlers.delete(requestId);
        }
        break;
      }
      case "ai.streamChunk": {
        const handler = this.streamHandlers.get(requestId);
        if (handler) {
          handler(data);
          // 流结束时清理
          if (data.done) {
            this.streamHandlers.delete(requestId);
          }
        }
        break;
      }
    }
  }

  /**
   * 发送模型 API 代理请求（非流式）
   */
  sendProxyRequest(
    request: {
      url: string;
      method: string;
      headers: Record<string, string>;
      body: string;
    },
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

      const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      if (signal?.aborted) {
        const error = new Error("请求已取消");
        error.name = "AbortError";
        reject(error);
        return;
      }

      const cleanup = () => {
        clearTimeout(timeout);
        this.responseHandlers.delete(requestId);
        signal?.removeEventListener("abort", handleAbort);
      };
      const handleAbort = () => {
        cleanup();
        const error = new Error("请求已取消");
        error.name = "AbortError";
        reject(error);
      };

      // 注册响应处理
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("代理请求超时（60s）"));
      }, 60000);

      signal?.addEventListener("abort", handleAbort, { once: true });

      this.responseHandlers.set(requestId, (data) => {
        cleanup();
        if (data.error) {
          reject(new Error(data.error));
        } else {
          resolve({
            status: data.status || 200,
            headers: data.headers || {},
            body:
              typeof data.body === "string"
                ? data.body
                : JSON.stringify(data.body),
          });
        }
      });

      // 发送代理请求
      const success = this.wsClient.send("ai.complete", {
        request_id: requestId,
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      if (!success) {
        cleanup();
        reject(new Error("代理请求发送失败，本地服务未连接"));
      }
    });
  }

  /**
   * 发送模型 API 流式代理请求
   * 返回一个 ReadableStream 供上层消费
   */
  sendStreamProxyRequest(request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string;
  }): { stream: ReadableStream<Uint8Array>; requestId: string } {
    const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        // 注册流处理器
        this.streamHandlers.set(requestId, (data) => {
          if (data.error) {
            controller.error(new Error(data.error));
            return;
          }
          if (data.chunk) {
            controller.enqueue(encoder.encode(data.chunk));
          }
          if (data.done) {
            controller.close();
          }
        });

        // 超时处理
        setTimeout(() => {
          if (this.streamHandlers.has(requestId)) {
            this.streamHandlers.delete(requestId);
            controller.error(new Error("流式代理请求超时（120s）"));
          }
        }, 120000);

        // 发送请求
        if (!this.wsClient) {
          controller.error(new Error("WebSocket 未连接"));
          return;
        }

        const success = this.wsClient.send("ai.stream.start", {
          request_id: requestId,
          url: request.url,
          method: request.method,
          headers: request.headers,
          body: request.body,
        });

        if (!success) {
          this.streamHandlers.delete(requestId);
          controller.error(new Error("流式代理请求发送失败"));
        }
      },
      cancel: () => {
        this.streamHandlers.delete(requestId);
        // 通知后端取消
        this.wsClient?.send("ai.stream.cancel", {
          request_id: requestId,
        });
      },
    });

    return { stream, requestId };
  }
}
