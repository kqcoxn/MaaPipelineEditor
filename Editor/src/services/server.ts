import { invoke } from "@tauri-apps/api/core";
import { Button, message, notification } from "antd";
import { createElement } from "react";

import { registerDebugProtocolListeners } from "../features/debug/registerProtocolListeners";
import { globalConfig } from "../stores/configStore";
import type { APIRoute, MessageHandler } from "./type";
import type {
  ArtifactRef,
  BridgeEventName,
  RpcError,
  RpcEvent,
  RpcMethod,
  RpcRequest,
  RpcResponse,
} from "./generated/bridge-v2";
import { AIProtocol } from "./protocols/AIProtocol";
import { ConfigProtocol } from "./protocols/ConfigProtocol";
import { DebugProtocolClient } from "./protocols/DebugProtocolClient";
import { ErrorProtocol } from "./protocols/ErrorProtocol";
import { FileProtocol } from "./protocols/FileProtocol";
import { LoggerProtocol } from "./protocols/LoggerProtocol";
import { MFWProtocol } from "./protocols/MFWProtocol";
import { ResourceProtocol } from "./protocols/ResourceProtocol";

const PORT_STORAGE_KEY = "mpe.localbridge.port";
const REQUEST_TIMEOUT_MS = 30_000;
const CONNECTION_TIMEOUT_MS = 5_000;

interface DesktopBootstrap {
  port: number;
  protocolVersion: string;
  packageVersion: string;
  status: string;
}

interface RequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  abortHandler?: () => void;
}

export class BridgeRpcError extends Error {
  constructor(
    public readonly code: string,
    messageText: string,
    public readonly data?: Record<string, unknown>,
  ) {
    super(messageText);
    this.name = "BridgeRpcError";
  }
}

export class LocalWebSocketServer {
  private ws: WebSocket | null = null;
  private port: number;
  private clientKind: "web" | "desktop" = "web";
  private clientVersion = globalConfig.version;
  private routes = new Map<string, Set<MessageHandler>>();
  private pending = new Map<string, PendingRequest>();
  private statusListeners = new Set<(connected: boolean) => void>();
  private connectingListeners = new Set<(connecting: boolean) => void>();
  private eventCursors = new Map<string, number>();
  private artifactUrls = new Map<string, string>();
  private isConnecting = false;
  private handshakeCompleted = false;
  private fragmentBootstrap = false;

  constructor(port = 9066) {
    this.port = port;
    this.captureFragmentBootstrap();
    if (!this.fragmentBootstrap) {
      const storedPort = Number(sessionStorage.getItem(PORT_STORAGE_KEY));
      if (Number.isInteger(storedPort) && storedPort > 0 && storedPort <= 65535) {
        this.port = storedPort;
      }
    }
  }

  setPort(port: number): void {
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      throw new Error(`无效的 LocalBridge 端口: ${port}`);
    }
    if (this.ws) this.disconnect();
    this.port = port;
  }

  hasBootstrap(): boolean {
    return this.fragmentBootstrap || this.isDesktopEnvironment();
  }

  onStatus(callback: (connected: boolean) => void): () => boolean {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  onConnecting(callback: (connecting: boolean) => void): () => boolean {
    this.connectingListeners.add(callback);
    return () => this.connectingListeners.delete(callback);
  }

  registerRoute(event: string, handler: MessageHandler): () => void {
    const handlers = this.routes.get(event) ?? new Set<MessageHandler>();
    handlers.add(handler);
    this.routes.set(event, handlers);
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) this.routes.delete(event);
    };
  }

  registerRoutes(routes: APIRoute[]): void {
    routes.forEach(({ path, handler }) => this.registerRoute(path, handler));
  }

  connect(): void {
    if (this.isConnected() || this.isConnecting) return;
    void this.connectInternal();
  }

  disconnect(): void {
    this.closeSocket("连接已由用户关闭");
  }

  send(method: string, params: unknown): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.handshakeCompleted) {
      return false;
    }
    void this.request(method as RpcMethod, params).catch((error: unknown) => {
      this.dispatch("system.error", normalizeError(error));
    });
    return true;
  }

  request<TResult = unknown>(
    method: RpcMethod,
    params: unknown,
    options: RequestOptions = {},
  ): Promise<TResult> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("LocalBridge 未连接"));
    }
    return this.requestOnOpenSocket<TResult>(method, params, options);
  }

  async uploadArtifact(blob: Blob, filename = "artifact.bin"): Promise<ArtifactRef> {
    const body = new FormData();
    body.append("file", blob, filename);
    const response = await fetch(this.artifactEndpoint(), {
      method: "POST",
      body,
    });
    if (!response.ok) {
      throw new Error(`artifact 上传失败: HTTP ${response.status}`);
    }
    return (await response.json()) as ArtifactRef;
  }

  async fetchArtifact(artifact: ArtifactRef | string): Promise<Blob> {
    return (await this.fetchArtifactResponse(artifact)).blob;
  }

  async fetchArtifactResponse(
    artifact: ArtifactRef | string,
  ): Promise<{ blob: Blob; headers: Headers }> {
    const artifactId = typeof artifact === "string" ? artifact : artifact.artifactId;
    const response = await fetch(`${this.artifactEndpoint()}/${encodeURIComponent(artifactId)}`);
    if (!response.ok) {
      throw new Error(`artifact 下载失败: HTTP ${response.status}`);
    }
    return { blob: await response.blob(), headers: response.headers };
  }

  async getArtifactUrl(artifact: ArtifactRef | string): Promise<string> {
    const artifactId = typeof artifact === "string" ? artifact : artifact.artifactId;
    const cached = this.artifactUrls.get(artifactId);
    if (cached) return cached;
    const url = URL.createObjectURL(await this.fetchArtifact(artifact));
    this.artifactUrls.set(artifactId, url);
    return url;
  }

  cacheArtifactUrl(artifactId: string, blob: Blob): string {
    this.revokeArtifactUrl(artifactId);
    const url = URL.createObjectURL(blob);
    this.artifactUrls.set(artifactId, url);
    return url;
  }

  revokeArtifactUrl(artifactId: string): void {
    const url = this.artifactUrls.get(artifactId);
    if (!url) return;
    URL.revokeObjectURL(url);
    this.artifactUrls.delete(artifactId);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.handshakeCompleted;
  }

  getIsConnecting(): boolean {
    return this.isConnecting;
  }

  destroy(): void {
    this.disconnect();
    this.routes.clear();
    this.statusListeners.clear();
    this.connectingListeners.clear();
    this.artifactUrls.forEach((url) => URL.revokeObjectURL(url));
    this.artifactUrls.clear();
  }

  private async connectInternal(): Promise<void> {
    this.setConnecting(true);
    try {
      await this.loadDesktopBootstrap();
      const socket = await this.openSocket();
      this.ws = socket;
      const hello = await this.requestOnOpenSocket<{
        protocolVersion: string;
        packageVersion: string;
      }>(
        "system.hello",
        {
          protocolVersion: globalConfig.protocolVersion,
          clientVersion: this.clientVersion,
          clientKind: this.clientKind,
          afterSeq: Object.fromEntries(this.eventCursors),
        },
        { timeoutMs: 15_000 },
      );
      if (hello.protocolVersion !== globalConfig.protocolVersion) {
        throw new Error(`LocalBridge 协议版本不匹配: ${hello.protocolVersion}`);
      }
      this.handshakeCompleted = true;
      this.setConnecting(false);
      this.emitStatus(true);
      notification.destroy("localbridge-connection-error");
      message.success("已连接到本地服务");
    } catch (error) {
      this.closeSocket(error instanceof Error ? error.message : "连接失败");
      this.showConnectionError(error);
    }
  }

  private openSocket(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(
        `ws://127.0.0.1:${this.port}/v2/ws`,
        "mpe.v2",
      );
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error("连接 LocalBridge 超时"));
      }, CONNECTION_TIMEOUT_MS);
      socket.onopen = () => {
        clearTimeout(timeout);
        socket.onmessage = (event) => this.handleMessage(event);
        socket.onclose = () => this.handleClose(socket);
        socket.onerror = () => undefined;
        resolve(socket);
      };
      socket.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("无法连接 LocalBridge"));
      };
    });
  }

  private requestOnOpenSocket<TResult>(
    method: RpcMethod,
    params: unknown,
    options: RequestOptions,
  ): Promise<TResult> {
    const socket = this.ws;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("LocalBridge 未连接"));
    }
    if (options.signal?.aborted) {
      return Promise.reject(new DOMException("请求已取消", "AbortError"));
    }
    const id = crypto.randomUUID();
    return new Promise<TResult>((resolve, reject) => {
      const abortHandler = options.signal
        ? () => {
            this.finishPending(id);
            reject(new DOMException("请求已取消", "AbortError"));
            void this.request("system.cancel", { requestId: id }, { timeoutMs: 5_000 }).catch(
              () => undefined,
            );
          }
        : undefined;
      const timeoutId = setTimeout(() => {
        this.finishPending(id);
        reject(new Error(`LocalBridge 请求超时: ${method}`));
        void this.request("system.cancel", { requestId: id }, { timeoutMs: 5_000 }).catch(
          () => undefined,
        );
      }, options.timeoutMs ?? REQUEST_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (value) => resolve(value as TResult),
        reject,
        timeoutId,
        signal: options.signal,
        abortHandler,
      });
      options.signal?.addEventListener("abort", abortHandler!, { once: true });
      const request: RpcRequest = {
        v: 2,
        type: "request",
        id,
        method,
        params: asParams(params),
      };
      socket.send(JSON.stringify(request));
    });
  }

  private handleMessage(event: MessageEvent<unknown>): void {
    if (typeof event.data !== "string") return;
    let messageValue: RpcResponse | RpcEvent;
    try {
      messageValue = JSON.parse(event.data) as RpcResponse | RpcEvent;
    } catch {
      console.error("[LocalBridge] 收到无效 JSON 消息");
      return;
    }
    if (messageValue.type === "response") {
      const pending = this.finishPending(messageValue.id);
      if (!pending) return;
      if (messageValue.error) {
        pending.reject(fromRpcError(messageValue.error));
      } else {
        pending.resolve(messageValue.result);
      }
      return;
    }
    if (messageValue.type === "event") {
      this.trackCursor(messageValue);
      this.dispatch(messageValue.event, messageValue.data);
    }
  }

  private finishPending(id: string): PendingRequest | undefined {
    const pending = this.pending.get(id);
    if (!pending) return undefined;
    this.pending.delete(id);
    clearTimeout(pending.timeoutId);
    if (pending.signal && pending.abortHandler) {
      pending.signal.removeEventListener("abort", pending.abortHandler);
    }
    return pending;
  }

  private trackCursor(event: RpcEvent): void {
    if (event.event !== "debug.event" || !isRecord(event.data)) return;
    const sessionId = event.data.sessionId;
    const seq = event.data.seq;
    if (typeof sessionId === "string" && typeof seq === "number") {
      this.eventCursors.set(sessionId, Math.max(seq, this.eventCursors.get(sessionId) ?? 0));
    }
  }

  private dispatch(event: string, data: unknown): void {
    const handlers = this.routes.get(event);
    if (!handlers || !this.ws) return;
    handlers.forEach((handler) => handler(data, this.ws!));
  }

  private handleClose(socket: WebSocket): void {
    if (socket !== this.ws) return;
    this.ws = null;
    this.handshakeCompleted = false;
    this.setConnecting(false);
    this.rejectPending("LocalBridge 连接已断开");
    this.emitStatus(false);
  }

  private closeSocket(reason: string): void {
    const socket = this.ws;
    this.ws = null;
    this.handshakeCompleted = false;
    this.setConnecting(false);
    this.rejectPending(reason);
    this.emitStatus(false);
    socket?.close();
  }

  private rejectPending(reason: string): void {
    [...this.pending.keys()].forEach((id) => {
      this.finishPending(id)?.reject(new Error(reason));
    });
  }

  private setConnecting(connecting: boolean): void {
    if (this.isConnecting === connecting) return;
    this.isConnecting = connecting;
    this.connectingListeners.forEach((listener) => listener(connecting));
  }

  private emitStatus(connected: boolean): void {
    this.statusListeners.forEach((listener) => listener(connected));
  }

  private captureFragmentBootstrap(): void {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const port = Number(fragment.get("mpelb-port"));
    if (!Number.isInteger(port) || port <= 0 || port > 65535) return;
    this.port = port;
    this.fragmentBootstrap = true;
    sessionStorage.setItem(PORT_STORAGE_KEY, String(port));
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }

  private async loadDesktopBootstrap(): Promise<void> {
    if (!this.isDesktopEnvironment()) return;
    const bootstrap = await invoke<DesktopBootstrap>("localbridge_bootstrap");
    if (bootstrap.protocolVersion !== globalConfig.protocolVersion) {
      throw new Error(`Desktop LocalBridge 协议不匹配: ${bootstrap.protocolVersion}`);
    }
    this.port = bootstrap.port;
    this.clientKind = "desktop";
    this.clientVersion = bootstrap.packageVersion;
  }

  private isDesktopEnvironment(): boolean {
    return "__TAURI_INTERNALS__" in window;
  }

  private artifactEndpoint(): string {
    return `http://127.0.0.1:${this.port}/v2/artifacts`;
  }

  private showConnectionError(error: unknown): void {
    const description = error instanceof Error ? error.message : "未知错误";
    const key = "localbridge-connection-error";
    notification.error({
      key,
      title: "本地服务连接失败",
      description,
      placement: "topRight",
      duration: 6,
      actions: createElement(
        Button,
        {
          type: "primary",
          size: "small",
          onClick: () => {
            window.open("https://mpe.codax.site/docs/guide/server/deploy.html", "_blank");
            notification.destroy(key);
          },
        },
        "查看文档",
      ),
    });
  }
}

function asParams(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  return { value };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fromRpcError(error: RpcError): BridgeRpcError {
  return new BridgeRpcError(error.code, error.message, error.data);
}

function normalizeError(error: unknown): Record<string, unknown> {
  if (error instanceof BridgeRpcError) {
    return { code: error.code, message: error.message, data: error.data };
  }
  return { code: "client_error", message: error instanceof Error ? error.message : String(error) };
}

export const localServer = new LocalWebSocketServer();
export const fileProtocol = new FileProtocol();
export const mfwProtocol = new MFWProtocol();
export const errorProtocol = new ErrorProtocol();
export const configProtocol = new ConfigProtocol();
export const debugProtocolClient = new DebugProtocolClient();
export const resourceProtocol = new ResourceProtocol();
export const loggerProtocol = new LoggerProtocol();
export const aiProtocol = new AIProtocol();

export function initializeWebSocket(): void {
  errorProtocol.register(localServer);
  fileProtocol.register(localServer);
  mfwProtocol.register(localServer);
  configProtocol.register(localServer);
  debugProtocolClient.register(localServer);
  registerDebugProtocolListeners(debugProtocolClient);
  resourceProtocol.register(localServer);
  loggerProtocol.register(localServer);
  aiProtocol.register(localServer);
}

export type { ArtifactRef, BridgeEventName };
