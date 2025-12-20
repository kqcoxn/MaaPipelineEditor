import {
  type MessageHandler,
  type APIRoute,
  type HandshakeResponse,
  SystemRoutes,
} from "./type.ts";
import { message } from "antd";
import { FileProtocol } from "./protocols/FileProtocol";
import { MFWProtocol } from "./protocols/MFWProtocol";
import { ErrorProtocol } from "./protocols/ErrorProtocol";
import { ConfigProtocol } from "./protocols/ConfigProtocol";
import { globalConfig } from "../stores/configStore";

const PROTOCOL_VERSION = globalConfig.protocolVersion;

export class LocalWebSocketServer {
  private ws: WebSocket | null = null;
  private url: string;
  private routes: Map<string, MessageHandler> = new Map();
  private onStatusChange?: (connected: boolean) => void;
  private onConnectingChange?: (isConnecting: boolean) => void;
  private connectTimeout: number | null = null;
  private isConnecting: boolean = false;
  private handshakeCompleted: boolean = false;
  private readonly CONNECTION_TIMEOUT = 3000;

  constructor(port: number = 9066) {
    this.url = `ws://localhost:${port}`;
    // 注册系统级路由
    this.registerSystemRoutes();
  }

  // 注册系统级路由
  private registerSystemRoutes() {
    // 握手响应处理
    this.routes.set(
      SystemRoutes.HANDSHAKE_RESPONSE,
      (data: HandshakeResponse) => {
        if (data.success) {
          this.handshakeCompleted = true;
          this.clearConnectTimeout();
          this.isConnecting = false;
          this.onConnectingChange?.(false);
          message.success(`已连接到本地服务`);
          this.onStatusChange?.(true);
        } else {
          console.error(
            "[WebSocket] 协议版本不匹配，前端需求:",
            PROTOCOL_VERSION,
            "，当前本地服务协议:",
            data.required_version
          );
          message.error(
            `协议版本不匹配，前端需求: ${PROTOCOL_VERSION}，当前本地服务协议: ${data.required_version}，请按后端提示更新`
          );
          // 主动断开连接
          this.disconnect();
        }
      }
    );
  }

  // 设置端口
  setPort(port: number) {
    const needReconnect =
      this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    if (needReconnect) {
      this.disconnect();
    }
    this.url = `ws://localhost:${port}`;
  }

  // 注册连接状态变化回调
  onStatus(callback: (connected: boolean) => void) {
    this.onStatusChange = callback;
  }

  // 注册连接中状态变化回调
  onConnecting(callback: (isConnecting: boolean) => void) {
    this.onConnectingChange = callback;
  }

  /**
   * 注册 API 路由
   * @example
   * server.registerRoute('/api/hello', (data, ws) => {
   *   server.send('/api/response', { message: 'Hello back!' });
   * });
   */
  registerRoute(path: string, handler: MessageHandler) {
    this.routes.set(path, handler);
  }

  // 批量注册路由
  registerRoutes(routes: APIRoute[]) {
    routes.forEach(({ path, handler }) => {
      this.registerRoute(path, handler);
    });
  }

  // 连接到 WebSocket 服务器
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.warn("[WebSocket] Already connected");
      return;
    }

    // 防止重复连接
    if (this.isConnecting) {
      console.warn("[WebSocket] Connection already in progress");
      message.warning("正在尝试连接本地服务中，请稍候...");
      return;
    }

    // 清除之前的超时定时器
    this.clearConnectTimeout();
    this.isConnecting = true;
    this.onConnectingChange?.(true);

    try {
      this.ws = new WebSocket(this.url);

      // 设置连接超时
      this.connectTimeout = window.setTimeout(() => {
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          console.error("[WebSocket] Connection timeout");
          message.error(`连接超时，请检查本地服务或端口是否可用`);
          this.ws.close();
          this.ws = null;
          this.isConnecting = false;
          this.onConnectingChange?.(false);
          this.onStatusChange?.(false);
        }
      }, this.CONNECTION_TIMEOUT);

      this.ws.onopen = () => {
        // 发送版本握手请求
        this.sendHandshake();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { path, data } = message;

          if (path && this.routes.has(path)) {
            const handler = this.routes.get(path)!;
            handler(data, this.ws!);
          } else {
            console.warn("[WebSocket] No handler for path:", path);
          }
        } catch (error) {
          console.error("[WebSocket] Failed to parse message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
        this.clearConnectTimeout();
        this.isConnecting = false;
        this.onConnectingChange?.(false);
        message.error(`连接失败，请检查本地服务或端口是否可用`);
      };

      this.ws.onclose = () => {
        this.clearConnectTimeout();
        this.isConnecting = false;
        this.onConnectingChange?.(false);
        message.info("本地服务已断开连接");
        this.onStatusChange?.(false);
        this.ws = null;
      };
    } catch (error) {
      console.error("[WebSocket] Connection failed:", error);
      this.clearConnectTimeout();
      this.isConnecting = false;
      this.onConnectingChange?.(false);
      message.error(
        `本地服务连接失败：${
          error instanceof Error ? error.message : "未知错误"
        }`
      );
      this.onStatusChange?.(false);
    }
  }

  // 断开连接
  disconnect() {
    this.clearConnectTimeout();
    this.isConnecting = false;
    this.handshakeCompleted = false;
    this.onConnectingChange?.(false);

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.onStatusChange?.(false);
  }

  // 发送版本握手请求
  private sendHandshake() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("[WebSocket] Cannot send handshake, not connected");
      return;
    }

    const handshakeData = {
      path: SystemRoutes.HANDSHAKE,
      data: {
        protocol_version: PROTOCOL_VERSION,
      },
    };

    this.ws.send(JSON.stringify(handshakeData));
  }

  // 发送消息
  send(path: string, data: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[WebSocket] Not connected, cannot send message");
      return false;
    }

    try {
      const message = JSON.stringify({ path, data });
      this.ws.send(message);
      return true;
    } catch (error) {
      console.error("[WebSocket] Failed to send message:", error);
      return false;
    }
  }

  // 获取连接状态
  isConnected(): boolean {
    return (
      this.ws !== null &&
      this.ws.readyState === WebSocket.OPEN &&
      this.handshakeCompleted
    );
  }

  // 是否正在连接中
  getIsConnecting(): boolean {
    return this.isConnecting;
  }

  // 清除连接超时定时器
  private clearConnectTimeout() {
    if (this.connectTimeout !== null) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
  }

  // 清理资源
  destroy() {
    this.disconnect();
    this.routes.clear();
    this.onStatusChange = undefined;
    this.onConnectingChange = undefined;
  }
}

export const localServer = new LocalWebSocketServer();

// 创建全局协议实例
export const fileProtocol = new FileProtocol();
export const mfwProtocol = new MFWProtocol();
export const errorProtocol = new ErrorProtocol();
export const configProtocol = new ConfigProtocol();

/**
 * 初始化 WebSocket 连接和所有响应路由
 * 应在应用启动时调用一次
 */
export function initializeWebSocket() {
  // 注册 ErrorProtocol
  errorProtocol.register(localServer);

  // 注册 FileProtocol
  fileProtocol.register(localServer);

  // 注册 MFWProtocol
  mfwProtocol.register(localServer);

  // 注册 ConfigProtocol
  configProtocol.register(localServer);

  // 监听连接成功事件，确保协议注册
  localServer.onStatus((connected) => {});
}
