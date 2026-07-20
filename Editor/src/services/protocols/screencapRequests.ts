import type { LocalWebSocketServer } from "../server";
import uiT from "../../i18n/translate";

const REQUEST_TIMEOUT_MS = 10000;

export interface ScreencapRequestParams {
  controller_id: string;
  use_cache?: boolean;
  target_long_side?: number;
  target_short_side?: number;
  use_raw_size?: boolean;
  output_long_side?: number;
}

export interface ScreencapResult {
  request_id: string;
  controller_id: string;
  success: boolean;
  image?: string;
  width?: number;
  height?: number;
  error?: string;
}

interface PendingRequest {
  resolve: (result: ScreencapResult) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  abortHandler?: () => void;
}

export class ScreencapRequestManager {
  private pendingRequests = new Map<string, PendingRequest>();

  request(
    wsClient: LocalWebSocketServer | null,
    params: ScreencapRequestParams,
    signal?: AbortSignal,
  ): Promise<ScreencapResult> {
    if (!wsClient) {
      return Promise.reject(
        new Error(
          uiT(
            "ui.services.screencap.localBridgeNotConnected",
            "LocalBridge 未连接",
          ),
        ),
      );
    }
    if (signal?.aborted) {
      return Promise.reject(
        new DOMException(
          uiT("ui.services.screencap.requestCancelled", "截图请求已取消"),
          "AbortError",
        ),
      );
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise<ScreencapResult>((resolve, reject) => {
      const abortHandler = signal
        ? () => {
            this.reject(
              requestId,
              new DOMException(
                uiT(
                  "ui.services.screencap.requestCancelled",
                  "截图请求已取消",
                ),
                "AbortError",
              ),
            );
          }
        : undefined;
      const timeoutId = setTimeout(() => {
        this.reject(
          requestId,
          new Error(
            uiT("ui.services.screencap.requestTimeout", "截图请求超时"),
          ),
        );
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeoutId,
        signal,
        abortHandler,
      });
      if (signal && abortHandler) {
        signal.addEventListener("abort", abortHandler, { once: true });
      }

      const sent = wsClient.send("/etl/mfw/request_screencap", {
        ...params,
        request_id: requestId,
      });
      if (!sent) {
        this.reject(
          requestId,
          new Error(
            uiT(
              "ui.services.screencap.requestSendFailed",
              "截图请求发送失败",
            ),
          ),
        );
      }
    });
  }

  resolve(result: ScreencapResult): void {
    const requestId = result?.request_id;
    if (!requestId) {
      console.warn("[MFWProtocol] Screenshot result missing request_id");
      return;
    }

    const pending = this.take(requestId);
    pending?.resolve(result);
  }

  rejectAll(reason: string): void {
    for (const requestId of [...this.pendingRequests.keys()]) {
      this.reject(requestId, new Error(reason));
    }
  }

  private take(requestId: string): PendingRequest | undefined {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return undefined;

    this.pendingRequests.delete(requestId);
    clearTimeout(pending.timeoutId);
    if (pending.signal && pending.abortHandler) {
      pending.signal.removeEventListener("abort", pending.abortHandler);
    }
    return pending;
  }

  private reject(requestId: string, error: Error): void {
    const pending = this.take(requestId);
    pending?.reject(error);
  }
}
