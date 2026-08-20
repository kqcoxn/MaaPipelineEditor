/**
 * AI Provider 抽象层类型定义
 * 统一 OpenAI / Anthropic / Gemini 三大厂商的接口
 */

/** 支持的 AI 厂商类型 */
export type AIProviderType = "openai" | "anthropic" | "gemini" | "custom";

/** AI 厂商配置 */
export interface AIProviderConfig {
  type: AIProviderType;
  /** 基础 URL 或完整的 OpenAI 兼容 chat/completions 端点 */
  apiUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
}

export interface UnifiedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** 统一消息格式 */
export interface UnifiedMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: UnifiedToolCall[];
  toolCallId?: string;
  name?: string;
}

/** 视觉图片 */
export interface VisionImage {
  base64: string;
  mimeType: string;
}

/** 统一响应格式 */
export interface UnifiedResponse {
  success: boolean;
  content: string;
  reasoning?: string;
  error?: string;
  toolCalls: UnifiedToolCall[];
  finishReason: UnifiedFinishReason;
  usage?: TokenUsage;
}

export type UnifiedFinishReason =
  | "stop"
  | "tool_calls"
  | "length"
  | "cancelled"
  | "error"
  | "unknown";

export interface ModelToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type ToolChoice = "auto" | "none" | "required" | { name: string };

export interface ToolCallDelta {
  index: number;
  id?: string;
  name?: string;
  argumentsDelta?: string;
  arguments?: Record<string, unknown>;
}

export interface UnifiedStreamDelta {
  content?: string;
  reasoning?: string;
  toolCalls?: ToolCallDelta[];
  finishReason?: UnifiedFinishReason;
  usage?: TokenUsage;
  done?: boolean;
}

/** Token 用量统计 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  isEstimated: boolean;
}

/** 构建好的 HTTP 请求（供代理转发使用） */
export interface ProviderRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  stream?: boolean;
}

/** 请求选项 */
export interface RequestOptions {
  stream?: boolean;
  images?: VisionImage[];
  tools?: ModelToolDefinition[];
  toolChoice?: ToolChoice;
}

/** AI Provider 接口 */
export interface AIProvider {
  readonly type: AIProviderType;
  readonly displayName: string;
  readonly defaultBaseUrl: string;
  /** 推荐模型列表 */
  readonly models: string[];
  /** 支持视觉的模型 */
  readonly visionModels: string[];

  /**
   * 构建 HTTP 请求（不执行，用于直连或代理转发）
   */
  buildRequest(
    messages: UnifiedMessage[],
    config: AIProviderConfig,
    options?: RequestOptions,
  ): ProviderRequest;

  /**
   * 从非流式响应体中提取内容和 token 用量
   */
  parseResponse(responseBody: unknown): UnifiedResponse;

  /** 从一个完整 SSE 事件中提取文本、工具参数增量和用量。 */
  parseStreamEvent?(event: {
    event?: string;
    data: string;
  }): UnifiedStreamDelta;

  /**
   * 从流式 SSE 数据行中提取 delta 内容
   * 返回 null 表示流结束，返回空字符串表示无内容的心跳
   */
  parseStreamChunk(line: string): string | null;

  /**
   * 从流式响应最终数据中提取 token 用量（如有）
   */
  parseStreamUsage?(finalData: any): TokenUsage | undefined;

  /**
   * 合并跨多个 SSE 事件返回的 token 用量（如有）
   */
  mergeStreamUsage?(current: TokenUsage | undefined, next: TokenUsage): TokenUsage;
}
