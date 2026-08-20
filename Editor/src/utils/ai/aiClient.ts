/**
 * AIClient 核心类
 * 支持多厂商 Provider、加密存储和代理转发的统一 AI 客户端
 */

import {
  normalizeAIRequestTimeoutMs,
  useConfigStore,
} from "@/stores/app/configStore";
import { decryptApiKey } from "./crypto";
import {
  getProvider,
  type AIProviderType,
  type AIProviderConfig,
  type UnifiedMessage,
  type TokenUsage,
  type ProviderRequest,
  type RequestOptions,
  type UnifiedFinishReason,
  type UnifiedResponse,
  type UnifiedToolCall,
} from "./providers";
import { localServer, aiProtocol } from "../../services/server";
import { SSEParser } from "./sse";

function createAbortError(): Error {
  const error = new Error("请求已取消");
  error.name = "AbortError";
  return error;
}

class AIRequestTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`模型请求超时（${Math.round(timeoutMs / 1000)}s）`);
    this.name = "AIRequestTimeoutError";
  }
}

function parseStreamToolArguments(value: string): Record<string, unknown> {
  if (!value.trim()) return {};
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("模型返回的工具参数必须是 JSON 对象");
  }
  return parsed;
}

/** 创建 AIClient 的配置项 */
export interface AIClientOptions {
  /** 系统提示词 */
  systemPrompt?: string;
  /** 保留的历史记录轮数，默认 10 */
  historyLimit?: number;
  /** 重试次数，默认 2 */
  retryCount?: number;
  /** 重试间隔(ms)，默认 1000 */
  retryDelay?: number;
  /** 单次模型请求超时；默认读取 AI 设置 */
  requestTimeoutMs?: number;
}

/** 流式响应回调 */
export type StreamCallback = (chunk: string, done: boolean) => void;

/** 对话请求结果 */
export interface ChatResult {
  success: boolean;
  content: string;
  error?: string;
}

/**
 * 统一 AI 客户端
 * 内部根据 configStore 中的 aiProviderType 选择对应的 Provider
 */
export class AIClient {
  private messages: UnifiedMessage[] = [];
  private systemPrompt: string;
  private historyLimit: number;
  private retryCount: number;
  private retryDelay: number;
  private requestTimeoutMs: number | undefined;
  private abortController: AbortController | null = null;
  private requestInFlight = false;
  private frozenConfig: AIProviderConfig | null = null;

  constructor(options: AIClientOptions = {}) {
    this.systemPrompt = options.systemPrompt || "";
    this.historyLimit = options.historyLimit ?? 10;
    this.retryCount = options.retryCount ?? 2;
    this.retryDelay = options.retryDelay ?? 1000;
    this.requestTimeoutMs = options.requestTimeoutMs;

    if (this.systemPrompt) {
      this.messages.push({ role: "system", content: this.systemPrompt });
    }
  }

  /** 获取当前 AI 配置（含解密） */
  private async getConfig(): Promise<AIProviderConfig> {
    if (this.frozenConfig) return { ...this.frozenConfig };
    const configs = useConfigStore.getState().configs;
    const apiKey = await decryptApiKey(configs.aiApiKey);

    return {
      type: (configs.aiProviderType as AIProviderType) || "openai",
      apiUrl: configs.aiApiUrl,
      apiKey,
      model: configs.aiModel,
      temperature: configs.aiTemperature,
    };
  }

  /** 校验配置 */
  private async validateConfig(): Promise<string | null> {
    const config = await this.getConfig();
    if (!config.apiUrl) return "API URL 未配置";
    if (!config.apiKey) return "API Key 未配置";
    if (!config.model) return "模型名称未配置";
    return null;
  }

  /** 添加消息并维护历史记录上限 */
  private addMessage(role: UnifiedMessage["role"], content: string) {
    this.messages.push({ role, content });
    this.trimHistory();
  }

  /** 裁剪历史记录 */
  private trimHistory() {
    const systemMsgs = this.messages.filter((m) => m.role === "system");
    const nonSystemMsgs = this.messages.filter((m) => m.role !== "system");
    const maxNonSystemMsgs = this.historyLimit * 2;
    if (nonSystemMsgs.length > maxNonSystemMsgs) {
      const trimmed = nonSystemMsgs.slice(-maxNonSystemMsgs);
      this.messages = [...systemMsgs, ...trimmed];
    }
  }

  /** 延时函数 */
  private delay(ms: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(createAbortError());

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        signal?.removeEventListener("abort", handleAbort);
        resolve();
      }, ms);
      const handleAbort = () => {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", handleAbort);
        reject(createAbortError());
      };
      signal?.addEventListener("abort", handleAbort, { once: true });
    });
  }

  private async waitForRetry(
    signal: AbortSignal,
  ): Promise<boolean> {
    try {
      await this.delay(this.retryDelay, signal);
      return true;
    } catch (err) {
      if (this.isAbortError(err)) return false;
      throw err;
    }
  }

  private isAbortError(err: unknown): boolean {
    return err instanceof Error && err.name === "AbortError";
  }

  private getRequestTimeoutMs(): number {
    return this.requestTimeoutMs ?? normalizeAIRequestTimeoutMs(
      useConfigStore.getState().configs.aiRequestTimeoutMinutes,
    );
  }

  private getAbortMessage(signal: AbortSignal): string {
    return signal.reason instanceof AIRequestTimeoutError
      ? signal.reason.message
      : "请求已取消";
  }

  private isRequestTimeout(signal: AbortSignal): boolean {
    return signal.reason instanceof AIRequestTimeoutError;
  }

  private removeLastUserMessage(): void {
    const lastMessage = this.messages[this.messages.length - 1];
    if (lastMessage?.role === "user") {
      this.messages = this.messages.slice(0, -1);
    }
  }

  /**
   * 判断错误是否可能是 CORS 导致的
   * 浏览器 CORS 错误表现为 TypeError: Failed to fetch，且无法获取更多信息
   */
  private isCorsLikeError(err: any): boolean {
    if (this.shouldUseProxy()) return false;
    return (
      err instanceof TypeError &&
      (err.message === "Failed to fetch" ||
        err.message === "NetworkError when attempting to fetch resource." ||
        err.message.includes("CORS"))
    );
  }

  /** 将错误转为用户友好的提示信息 */
  private formatError(err: any): string {
    if (this.isCorsLikeError(err)) {
      return (
        "请求失败，可能是浏览器跨域(CORS)限制。" +
        "请开启 LocalBridge 代理（设置 → AI → 使用 LocalBridge 代理），" +
        "或确认 API 服务已允许当前域的跨域请求。"
      );
    }
    return err.message || String(err);
  }

  /** 判断是否应使用代理模式 */
  private shouldUseProxy(): boolean {
    const configs = useConfigStore.getState().configs;
    return !!configs.aiUseProxy && localServer.isConnected();
  }

  /**
   * 执行 HTTP 请求
   * 根据配置自动选择直连或 LocalBridge 代理
   */
  private async executeRequest(
    request: ProviderRequest,
    signal?: AbortSignal,
    timeoutMs?: number,
  ): Promise<Response> {
    if (this.shouldUseProxy()) {
      // 通过 LocalBridge 代理
      return this.executeProxyRequest(request, signal, timeoutMs);
    }
    // 直连
    return fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal,
    });
  }

  /**
   * 通过 LocalBridge WebSocket 代理执行 AI 请求
   */
  private async executeProxyRequest(
    request: ProviderRequest,
    signal?: AbortSignal,
    timeoutMs?: number,
  ): Promise<Response> {
    const proxyRequest = {
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: request.body,
    };

    if (request.stream) {
      const { stream } = aiProtocol.sendStreamProxyRequest(
        proxyRequest,
        timeoutMs,
        signal,
      );
      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }

    const result = await aiProtocol.sendProxyRequest(
      proxyRequest,
      timeoutMs,
      signal,
    );

    return new Response(result.body, {
      status: result.status,
      headers: result.headers,
    });
  }

  private async withRequest<T>(
    operation: (
      controller: AbortController,
      timeoutMs: number,
    ) => Promise<T>,
  ): Promise<T> {
    if (this.requestInFlight) {
      throw new Error("当前 AIClient 已有请求正在进行");
    }

    const controller = new AbortController();
    const timeoutMs = this.getRequestTimeoutMs();
    const timeout = setTimeout(
      () => controller.abort(new AIRequestTimeoutError(timeoutMs)),
      timeoutMs,
    );
    this.requestInFlight = true;
    this.abortController = controller;
    try {
      return await operation(controller, timeoutMs);
    } finally {
      clearTimeout(timeout);
      if (this.abortController === controller) {
        this.abortController = null;
      }
      this.requestInFlight = false;
    }
  }

  /**
   * 估算 token 用量
   */
  private estimateTokenUsage(
    promptText: string,
    completionText: string,
  ): TokenUsage {
    const estimateTokens = (text: string) => Math.ceil(text.length / 1.3);
    const promptTokens = estimateTokens(promptText);
    const completionTokens = estimateTokens(completionText);
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      isEstimated: true,
    };
  }

  /**
   * 发送消息（非流式）
   */
  async send(userMessage: string): Promise<ChatResult> {
    return this.withRequest(async (controller, timeoutMs) => {
      const configError = await this.validateConfig();
      if (configError) {
        return { success: false, content: "", error: configError };
      }

      this.addMessage("user", userMessage);
      const config = await this.getConfig();
      const provider = getProvider(config.type);

      let lastError = "";
      for (let attempt = 0; attempt <= this.retryCount; attempt++) {
        try {
          const request = provider.buildRequest(this.messages, config, {
            stream: false,
          });
          const response = await this.executeRequest(
            request,
            controller.signal,
            timeoutMs,
          );

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText}`);
          }

          const data = await response.json();
          const { content } = provider.parseResponse(data);
          this.addMessage("assistant", content);

          return { success: true, content };
        } catch (err: any) {
          if (controller.signal.aborted || this.isAbortError(err)) {
            this.removeLastUserMessage();
            return {
              success: false,
              content: "",
              error: this.getAbortMessage(controller.signal),
            };
          }
          lastError = this.formatError(err);
          // CORS 类错误不重试（重试也无法解决）
          if (this.isCorsLikeError(err)) break;
          if (attempt < this.retryCount) {
            const canRetry = await this.waitForRetry(controller.signal);
            if (!canRetry) {
              this.removeLastUserMessage();
              return {
                success: false,
                content: "",
                error: this.getAbortMessage(controller.signal),
              };
            }
          }
        }
      }

      this.removeLastUserMessage();
      return { success: false, content: "", error: lastError };
    });
  }

  /**
   * 发送消息（流式响应）
   */
  async sendStream(
    userMessage: string,
    onChunk: StreamCallback,
  ): Promise<ChatResult> {
    return this.withRequest(async (controller, timeoutMs) => {
      const configError = await this.validateConfig();
      if (configError) {
        return { success: false, content: "", error: configError };
      }

      this.addMessage("user", userMessage);
      const config = await this.getConfig();
      const provider = getProvider(config.type);

      let lastError = "";
      let hasDeliveredChunk = false;
      for (let attempt = 0; attempt <= this.retryCount; attempt++) {
        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
        let readerCompleted = false;
        try {
          const request = provider.buildRequest(this.messages, config, {
            stream: true,
          });
          const response = await this.executeRequest(
            request,
            controller.signal,
            timeoutMs,
          );

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText}`);
          }

          reader = response.body?.getReader() ?? null;
          if (!reader) throw new Error("无法获取响应流");

          const decoder = new TextDecoder();
          const parser = new SSEParser();
          let fullContent = "";
          let providerDone = false;

          const processEvent = (event: { event?: string; data: string }) => {
            if (providerDone) return;

            const lines = event.event
              ? [`event: ${event.event}`, `data: ${event.data}`]
              : [`data: ${event.data}`];
            for (const line of lines) {
              const delta = provider.parseStreamChunk(line);
              if (delta === null) {
                providerDone = true;
                hasDeliveredChunk = true;
                onChunk("", true);
                break;
              }
              if (delta) {
                fullContent += delta;
                hasDeliveredChunk = true;
                onChunk(delta, false);
              }
            }
          };

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              readerCompleted = true;
              break;
            }

            const text = decoder.decode(value, { stream: true });
            for (const event of parser.push(text)) processEvent(event);
            if (providerDone) {
              await reader.cancel();
              readerCompleted = true;
              break;
            }
          }

          if (!providerDone) {
            const trailingText = decoder.decode();
            for (const event of parser.push(trailingText)) processEvent(event);
            for (const event of parser.flush()) processEvent(event);
          }

          if (!providerDone) {
            providerDone = true;
            hasDeliveredChunk = true;
            onChunk("", true);
          }

          this.addMessage("assistant", fullContent);
          return { success: true, content: fullContent };
        } catch (err: any) {
          if (controller.signal.aborted || this.isAbortError(err)) {
            this.removeLastUserMessage();
            return {
              success: false,
              content: "",
              error: this.getAbortMessage(controller.signal),
            };
          }
          lastError = this.formatError(err);
          if (this.isCorsLikeError(err) || hasDeliveredChunk) break;
          if (attempt < this.retryCount) {
            const canRetry = await this.waitForRetry(controller.signal);
            if (!canRetry) {
              this.removeLastUserMessage();
              return {
                success: false,
                content: "",
                error: this.getAbortMessage(controller.signal),
              };
            }
          }
        } finally {
          if (reader && !readerCompleted) {
            try {
              await reader.cancel();
            } catch {
              // 流已进入错误状态时，cancel 可能再次失败。
            }
          }
          reader?.releaseLock();
        }
      }

      this.removeLastUserMessage();
      return { success: false, content: "", error: lastError };
    });
  }

  /**
   * 执行一次无业务历史的模型请求。Harness 通过此入口统一接收文本、
   * 工具调用、结束原因和 Token 用量。
   */
  async complete(
    messages: UnifiedMessage[],
    options: RequestOptions = {},
    onTextDelta?: (delta: string) => void,
    onReasoningDelta?: (delta: string) => void,
  ): Promise<UnifiedResponse> {
    return this.withRequest(async (controller, timeoutMs) => {
      const configError = await this.validateConfig();
      if (configError) {
        return {
          success: false,
          content: "",
          error: configError,
          toolCalls: [],
          finishReason: "error",
        };
      }

      const config = await this.getConfig();
      const provider = getProvider(config.type);
      const stream = options.stream ?? true;
      const request = provider.buildRequest(messages, config, {
        ...options,
        stream,
      });
      const promptText = messages.map((message) => message.content).join(" ");

      try {
        const response = await this.executeRequest(
          request,
          controller.signal,
          timeoutMs,
        );
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        if (!stream) {
          const parsed = provider.parseResponse(await response.json());
          return {
            ...parsed,
            usage:
              parsed.usage ||
              this.estimateTokenUsage(promptText, parsed.content),
          };
        }

        return await this.readUnifiedStream(
          response,
          provider,
          promptText,
          onTextDelta,
          onReasoningDelta,
          controller.signal,
        );
      } catch (error) {
        if (controller.signal.aborted || this.isAbortError(error)) {
          const timedOut = this.isRequestTimeout(controller.signal);
          return {
            success: false,
            content: "",
            error: this.getAbortMessage(controller.signal),
            toolCalls: [],
            finishReason: timedOut ? "error" : "cancelled",
          };
        }
        return {
          success: false,
          content: "",
          error: this.formatError(error),
          toolCalls: [],
          finishReason: "error",
        };
      }
    });
  }

  async getModelConfigSnapshot(): Promise<
    Pick<AIProviderConfig, "type" | "apiUrl" | "model" | "temperature">
  > {
    const { type, apiUrl, model, temperature } = await this.getConfig();
    return { type, apiUrl, model, temperature };
  }

  async freezeModelConfig(): Promise<
    Pick<AIProviderConfig, "type" | "apiUrl" | "model" | "temperature">
  > {
    const config = await this.getConfig();
    this.frozenConfig = { ...config };
    const { type, apiUrl, model, temperature } = config;
    return { type, apiUrl, model, temperature };
  }

  private async readUnifiedStream(
    response: Response,
    provider: ReturnType<typeof getProvider>,
    promptText: string,
    onTextDelta: ((delta: string) => void) | undefined,
    onReasoningDelta: ((delta: string) => void) | undefined,
    signal: AbortSignal,
  ): Promise<UnifiedResponse> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("无法获取响应流");

    const parser = new SSEParser();
    const decoder = new TextDecoder();
    const toolFragments = new Map<
      number,
      {
        id?: string;
        name?: string;
        argumentsText: string;
        arguments?: Record<string, unknown>;
      }
    >();
    let content = "";
    let reasoning = "";
    let finishReason: UnifiedFinishReason = "unknown";
    let usage: TokenUsage | undefined;

    const processEvent = (event: { event?: string; data: string }) => {
      const delta = provider.parseStreamEvent?.(event);
      if (!delta) return;
      if (delta.content) {
        content += delta.content;
        onTextDelta?.(delta.content);
      }
      if (delta.reasoning) {
        reasoning += delta.reasoning;
        onReasoningDelta?.(delta.reasoning);
      }
      if (delta.finishReason) finishReason = delta.finishReason;
      if (delta.usage) {
        usage = provider.mergeStreamUsage
          ? provider.mergeStreamUsage(usage, delta.usage)
          : delta.usage;
      }
      delta.toolCalls?.forEach((toolCall) => {
        const current = toolFragments.get(toolCall.index) ?? {
          argumentsText: "",
        };
        toolFragments.set(toolCall.index, {
          id: toolCall.id ?? current.id,
          name: toolCall.name ?? current.name,
          argumentsText:
            current.argumentsText + (toolCall.argumentsDelta ?? ""),
          arguments: toolCall.arguments ?? current.arguments,
        });
      });
    };

    try {
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const event of parser.push(decoder.decode(value, { stream: true }))) {
          processEvent(event);
        }
      }
      if (signal.aborted) throw createAbortError();
      const trailingText = decoder.decode();
      for (const event of parser.push(trailingText)) processEvent(event);
      for (const event of parser.flush()) processEvent(event);
    } finally {
      reader.releaseLock();
    }

    const toolCalls: UnifiedToolCall[] = [...toolFragments.entries()]
      .sort(([left], [right]) => left - right)
      .map(([index, fragment]) => ({
        id: fragment.id || `tool_${index}`,
        name: fragment.name || "",
        arguments:
          fragment.arguments ?? parseStreamToolArguments(fragment.argumentsText),
      }));

    return {
      success: true,
      content,
      reasoning: reasoning || undefined,
      toolCalls,
      finishReason: toolCalls.length > 0 ? "tool_calls" : finishReason,
      usage: usage || this.estimateTokenUsage(promptText, content),
    };
  }

  /**
   * 发送带图片的消息（Vision）
   */
  async sendVision(
    textContent: string,
    imageBase64: string,
  ): Promise<ChatResult> {
    return this.withRequest(async (controller, timeoutMs) => {
      const configError = await this.validateConfig();
      if (configError) {
        return { success: false, content: "", error: configError };
      }

      this.addMessage("user", textContent);
      const config = await this.getConfig();
      const provider = getProvider(config.type);

      let lastError = "";
      for (let attempt = 0; attempt <= this.retryCount; attempt++) {
        try {
          const request = provider.buildRequest(this.messages, config, {
            stream: false,
            images: [{ base64: imageBase64, mimeType: "image/png" }],
          });
          const response = await this.executeRequest(
            request,
            controller.signal,
            timeoutMs,
          );

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText}`);
          }

          const data = await response.json();
          const { content } = provider.parseResponse(data);
          this.addMessage("assistant", content);

          return { success: true, content };
        } catch (err: any) {
          if (controller.signal.aborted || this.isAbortError(err)) {
            this.removeLastUserMessage();
            return {
              success: false,
              content: "",
              error: this.getAbortMessage(controller.signal),
            };
          }
          lastError = this.formatError(err);
          if (this.isCorsLikeError(err)) break;
          if (attempt < this.retryCount) {
            const canRetry = await this.waitForRetry(controller.signal);
            if (!canRetry) {
              this.removeLastUserMessage();
              return {
                success: false,
                content: "",
                error: this.getAbortMessage(controller.signal),
              };
            }
          }
        }
      }

      this.removeLastUserMessage();
      return { success: false, content: "", error: lastError };
    });
  }

  /** 取消当前请求 */
  abort() {
    this.abortController?.abort();
    this.abortController = null;
  }

  /** 清空对话历史 */
  clear() {
    this.messages = this.systemPrompt
      ? [{ role: "system", content: this.systemPrompt }]
      : [];
  }

  /** 更新系统提示词 */
  setSystemPrompt(prompt: string) {
    this.systemPrompt = prompt;
    const sysIndex = this.messages.findIndex((m) => m.role === "system");
    if (sysIndex >= 0) {
      if (prompt) {
        this.messages[sysIndex].content = prompt;
      } else {
        this.messages.splice(sysIndex, 1);
      }
    } else if (prompt) {
      this.messages.unshift({ role: "system", content: prompt });
    }
  }
}
