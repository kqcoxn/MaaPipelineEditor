/**
 * iframe 嵌入模式桥接模块
 * 用于检测嵌入环境并提供 postMessage 双向通信
 * 镜像 wailsBridge.ts 的环境检测 + 条件桥接模式
 */

export const PROTOCOL_VERSION = "1.0.0";

/** 协议消息信封 */
export interface EmbedMessage {
  protocol: "mpe-embed";
  version: string;
  type: string;
  requestId?: string;
  payload: any;
}

/** 能力声明 */
export interface EmbedCapabilities {
  readOnly: boolean;
  allowCopy: boolean;
  allowUndoRedo: boolean;
  allowAutoLayout: boolean;
  allowAI: boolean;
  allowSearch: boolean;
  allowCustomTemplate: boolean;
}

/** UI 配置 */
export interface EmbedUIConfig {
  hideHeader: boolean;
  hideToolbar: boolean;
  hiddenPanels: string[];
}

/** 握手配置 */
export interface EmbedInitConfig {
  capabilities: EmbedCapabilities;
  ui: EmbedUIConfig;
}

/** 默认能力集（PRD 5.2） */
export const DEFAULT_CAPABILITIES: EmbedCapabilities = {
  readOnly: false,
  allowCopy: true,
  allowUndoRedo: true,
  allowAutoLayout: true,
  allowAI: false,
  allowSearch: true,
  allowCustomTemplate: true,
};

/** 默认 UI 配置 */
export const DEFAULT_UI: EmbedUIConfig = {
  hideHeader: false,
  hideToolbar: false,
  hiddenPanels: [],
};

// ============ 内部状态 ============

let messageHandler: ((event: MessageEvent) => void) | null = null;
let handlers: Map<
  string,
  Set<(payload: any, requestId?: string) => void>
> = new Map();
let handshakeTimeoutId: ReturnType<typeof setTimeout> | null = null;
let isHandshakeCompleted = false;

// ============ 环境检测 ============

/**
 * 检测是否在 iframe 嵌入模式中运行
 */
export function isEmbedEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("embed") === "true";
}

/**
 * 获取 URL 参数中声明的宿主 origin
 */
export function getEmbedOrigin(): string | null {
  if (typeof window === "undefined") return null;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("origin");
}

/**
 * 获取当前 window 的 origin（用于调试）
 */
export function getCurrentOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

// ============ 消息收发 ============

/**
 * 构造协议消息信封
 */
function buildMessage(
  type: string,
  payload: any,
  requestId?: string,
): EmbedMessage {
  return {
    protocol: "mpe-embed",
    version: PROTOCOL_VERSION,
    type,
    ...(requestId ? { requestId } : {}),
    payload,
  };
}

/**
 * 向宿主（父窗口）发送消息
 */
export function sendToParent(
  type: string,
  payload: any,
  requestId?: string,
): void {
  if (typeof window === "undefined") return;
  const msg = buildMessage(type, payload, requestId);
  window.parent.postMessage(msg, "*");
}

/**
 * 注册指定类型消息的处理器
 * @returns 取消订阅函数
 */
export function onParentMessage(
  type: string,
  handler: (payload: any, requestId?: string) => void,
): () => void {
  if (!handlers.has(type)) {
    handlers.set(type, new Set());
  }
  handlers.get(type)!.add(handler);
  return () => {
    handlers.get(type)?.delete(handler);
  };
}

/**
 * 移除指定类型消息的处理器
 */
export function offParentMessage(
  type: string,
  handler: (payload: any, requestId?: string) => void,
): void {
  handlers.get(type)?.delete(handler);
}

/**
 * 分发消息到对应的处理器
 */
function dispatchMessage(type: string, payload: any, requestId?: string): void {
  const typeHandlers = handlers.get(type);
  if (!typeHandlers) return;
  typeHandlers.forEach((handler) => {
    try {
      handler(payload, requestId);
    } catch (err) {
      console.error(`[EmbedBridge] Handler error for ${type}:`, err);
    }
  });
}

// ============ 初始化与握手 ============

/**
 * 初始化 iframe 嵌入桥接
 * 注册 message 监听器，启动握手超时
 * @returns cleanup 清理函数
 */
export function initEmbedBridge(): { cleanup: () => void } {
  if (typeof window === "undefined") {
    return { cleanup: () => {} };
  }

  // 重置状态
  isHandshakeCompleted = false;
  handlers.clear();

  // 消息处理函数
  messageHandler = (event: MessageEvent) => {
    // 协议标识校验
    const data = event.data;
    if (!data || data.protocol !== "mpe-embed") {
      return;
    }

    // origin 校验：仅当 origin 参数为有效 URL 时才做严格匹配
    // （origin 参数可能是标识符如 "vscode-maa"，此时仅用于日志，不阻断消息）
    const expectedOrigin = getEmbedOrigin();
    if (
      expectedOrigin &&
      expectedOrigin.startsWith("http") &&
      event.origin !== expectedOrigin
    ) {
      console.warn(
        `[EmbedBridge] Origin mismatch: expected=${expectedOrigin}, got=${event.origin}`,
      );
      return;
    }

    // 握手完成前，仅处理 mpe:init
    if (!isHandshakeCompleted && data.type !== "mpe:init") {
      return;
    }

    dispatchMessage(data.type, data.payload, data.requestId);
  };

  window.addEventListener("message", messageHandler);

  // 启动 5s 握手超时
  handshakeTimeoutId = setTimeout(() => {
    if (!isHandshakeCompleted) {
      console.warn(
        "[EmbedBridge] Handshake timeout, using default capabilities",
      );
      completeHandshake(DEFAULT_CAPABILITIES, DEFAULT_UI);
    }
  }, 5000);

  return {
    cleanup: () => {
      if (messageHandler) {
        window.removeEventListener("message", messageHandler);
        messageHandler = null;
      }
      if (handshakeTimeoutId) {
        clearTimeout(handshakeTimeoutId);
        handshakeTimeoutId = null;
      }
      handlers.clear();
      isHandshakeCompleted = false;
    },
  };
}

/**
 * 完成握手，发送 mpe:ready
 */
export function completeHandshake(
  capabilities: EmbedCapabilities,
  ui: EmbedUIConfig,
  requestId?: string,
): void {
  if (isHandshakeCompleted) return;
  isHandshakeCompleted = true;

  if (handshakeTimeoutId) {
    clearTimeout(handshakeTimeoutId);
    handshakeTimeoutId = null;
  }

  const supportedCaps = Object.keys(capabilities).filter(
    (key) => (capabilities as any)[key],
  );

  sendToParent(
    "mpe:ready",
    {
      version: PROTOCOL_VERSION,
      supportedCaps,
    },
    requestId,
  );
}

/**
 * 查询握手是否已完成
 */
export function isEmbedReady(): boolean {
  return isHandshakeCompleted;
}
