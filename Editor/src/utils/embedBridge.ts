import { useEmbedMessageLogStore } from "@/stores/embed/embedMessageLogStore";

/**
 * iframe 嵌入模式桥接模块
 * 用于检测嵌入环境并提供 postMessage 双向通信
 * 提供与本地服务解耦的条件桥接模式
 */

export const PROTOCOL_VERSION = "1.4.0";

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
  allowSearch: boolean;
  allowCustomTemplate: boolean;
  hostNodeNavigation: boolean;
}

export interface EmbedAnchorDefinition {
  anchorName: string;
  nodeName: string;
  fileName: string;
  relativePath: string;
  isCurrentFile: boolean;
}

export interface EmbedNodeNavigationResultPayload {
  success: boolean;
  nodeName: string;
  message?: string;
}

/** UI 配置 */
export interface EmbedUIConfig {
  hideHeader: boolean;
  hideToolbar: boolean;
  hiddenPanels: string[];
}

/** 宿主信息 */
export interface EmbedHostInfo {
  id?: string;
  name?: string;
  repositoryUrl?: string;
}

/** MSE 不支持独立的 MPE 配置文件。 */
export function isMseHost(host: EmbedHostInfo | null | undefined): boolean {
  return host?.id === "mse";
}

export type EmbedLocale = "zh-cn" | "en-us";

export function getEmbedLocale(): EmbedLocale {
  const language =
    (typeof document !== "undefined" && document.documentElement.lang) ||
    (typeof navigator !== "undefined" && navigator.language) ||
    "zh-CN";
  return language.toLowerCase().startsWith("zh") ? "zh-cn" : "en-us";
}

export function getEmbedHostName(
  host: EmbedHostInfo | null | undefined,
  locale: EmbedLocale = getEmbedLocale(),
): string {
  const name = host?.name?.trim();
  return name || (locale === "zh-cn" ? "宿主" : "Host");
}

/** 握手配置 */
export interface EmbedInitConfig {
  capabilities: EmbedCapabilities;
  ui: EmbedUIConfig;
  host?: EmbedHostInfo;
}

export interface EmbedSaveRequestPayload {
  hint: "user-triggered" | "user-confirmed-force";
  force: boolean;
}

export type EmbedSaveMode = "integrated" | "separated";

/** MPE 生成、宿主执行写入的嵌入保存数据。 */
export interface EmbedSaveDataPayload {
  fileName: string;
  mode: EmbedSaveMode;
  /** 集成格式数据；分离格式下作为旧版宿主 fallback 保留。 */
  data?: unknown;
  pipeline?: unknown;
  config?: unknown;
}

export interface EmbedSaveResultPayload {
  success: boolean;
  code?: string;
  message?: string;
  error?: string;
  canForce?: boolean;
  documentVersion?: number;
}

interface InitEmbedBridgeOptions {
  onHandshakeTimeout?: (
    capabilities: EmbedCapabilities,
    ui: EmbedUIConfig,
  ) => void;
}

/** 默认能力集（PRD 5.2） */
export const DEFAULT_CAPABILITIES: EmbedCapabilities = {
  readOnly: false,
  allowCopy: true,
  allowUndoRedo: true,
  allowAutoLayout: true,
  allowSearch: true,
  allowCustomTemplate: true,
  hostNodeNavigation: false,
};

/** 默认 UI 配置 */
export const DEFAULT_UI: EmbedUIConfig = {
  hideHeader: false,
  hideToolbar: false,
  hiddenPanels: [],
};

// ============ 内部状态 ============

let messageHandler: ((event: MessageEvent) => void) | null = null;
const handlers: Map<
  string,
  Set<(payload: any, requestId?: string) => void>
> = new Map();
let handshakeTimeoutId: ReturnType<typeof setTimeout> | null = null;
let isHandshakeCompleted = false;
let requestIdCounter = 0;

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

function getValidatedEmbedOrigin(): string | null {
  const configuredOrigin = getEmbedOrigin();
  if (!configuredOrigin?.startsWith("http")) return null;

  try {
    return new URL(configuredOrigin).origin;
  } catch {
    console.warn(`[EmbedBridge] Invalid origin: ${configuredOrigin}`);
    return null;
  }
}

export function isCompatibleProtocolVersion(version: unknown): boolean {
  if (typeof version !== "string") return false;
  const expectedMajor = PROTOCOL_VERSION.split(".")[0];
  const receivedMajor = version.split(".")[0];
  return receivedMajor === expectedMajor;
}

/**
 * 获取当前 window 的 origin（用于调试）
 */
export function getCurrentOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function createEmbedRequestId(prefix: string): string {
  requestIdCounter += 1;
  return `${prefix}-${Date.now()}-${requestIdCounter}`;
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
  const targetOrigin = getValidatedEmbedOrigin() ?? "*";
  useEmbedMessageLogStore.getState().addLog({
    direction: "outgoing",
    type: msg.type,
    version: msg.version,
    requestId: msg.requestId,
    origin: targetOrigin,
    payload: msg.payload,
  });
  window.parent.postMessage(msg, targetOrigin);
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
export function initEmbedBridge(
  options: InitEmbedBridgeOptions = {},
): { cleanup: () => void } {
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

    if (event.source !== window.parent) {
      return;
    }

    // origin 校验：仅当 origin 参数为有效 URL 时才做严格匹配
    // （origin 参数可能是标识符如 "vscode-maa"，此时仅用于日志，不阻断消息）
    const expectedOrigin = getValidatedEmbedOrigin();
    if (expectedOrigin && event.origin !== expectedOrigin) {
      console.warn(
        `[EmbedBridge] Origin mismatch: expected=${expectedOrigin}, got=${event.origin}`,
      );
      return;
    }

    if (!isCompatibleProtocolVersion(data.version)) {
      sendToParent(
        "mpe:error",
        {
          code: "protocol_version_mismatch",
          message: `Unsupported mpe-embed version: ${String(data.version)}`,
          detail: { supportedVersion: PROTOCOL_VERSION },
        },
        data.requestId,
      );
      return;
    }

    useEmbedMessageLogStore.getState().addLog({
      direction: "incoming",
      type: data.type,
      version: data.version,
      requestId: data.requestId,
      origin: event.origin,
      payload: data.payload,
    });

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
      options.onHandshakeTimeout?.(DEFAULT_CAPABILITIES, DEFAULT_UI);
      completeHandshake(DEFAULT_CAPABILITIES);
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
