/**
 * AIClient 核心类
 * 替代旧版 OpenAIChat，支持多厂商 Provider、加密存储、代理转发
 */

import { useConfigStore } from "../../stores/configStore";
import { aiHistoryManager } from "./history";
import { decryptApiKey } from "./crypto";
import {
  getProvider,
  type AIProviderType,
  type AIProviderConfig,
  type UnifiedMessage,
  type TokenUsage,
  type ProviderRequest,
} from "./providers";
import { localServer, aiProtocol } from "../../services/server";

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
  private abortController: AbortController | null = null;

  constructor(options: AIClientOptions = {}) {
    this.systemPrompt = options.systemPrompt || "";
    this.historyLimit = options.historyLimit ?? 10;
    this.retryCount = options.retryCount ?? 2;
    this.retryDelay = options.retryDelay ?? 1000;

    if (this.systemPrompt) {
      this.messages.push({ role: "system", content: this.systemPrompt });
    }
  }

  /** 获取当前 AI 配置（含解密） */
  private async getConfig(): Promise<AIProviderConfig> {
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
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
  ): Promise<Response> {
    if (this.shouldUseProxy()) {
      // 通过 LocalBridge 代理
      return this.executeProxyRequest(request, signal);
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
    _signal?: AbortSignal,
  ): Promise<Response> {
    const result = await aiProtocol.sendProxyRequest({
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    return new Response(result.body, {
      status: result.status,
      headers: result.headers,
    });
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
  async send(userMessage: string, userPrompt?: string): Promise<ChatResult> {
    const configError = await this.validateConfig();
    if (configError) {
      aiHistoryManager.addRecord({
        userPrompt: userPrompt || userMessage,
        actualMessage: userMessage,
        response: "",
        success: false,
        error: configError,
      });
      return { success: false, content: "", error: configError };
    }

    this.addMessage("user", userMessage);
    const config = await this.getConfig();
    const provider = getProvider(config.type);

    let lastError = "";
    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      try {
        this.abortController = new AbortController();
        const request = provider.buildRequest(this.messages, config, {
          stream: false,
        });

        const response = await this.executeRequest(
          request,
          this.abortController.signal,
        );

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const { content, usage } = provider.parseResponse(data);
        this.addMessage("assistant", content);

        const finalUsage =
          usage ||
          this.estimateTokenUsage(
            this.messages.map((m) => m.content).join(" "),
            content,
          );

        aiHistoryManager.addRecord({
          userPrompt: userPrompt || userMessage,
          actualMessage: userMessage,
          response: content,
          success: true,
          textContent: userMessage,
          tokenUsage: finalUsage,
        });

        return { success: true, content };
      } catch (err: any) {
        if (err.name === "AbortError") {
          this.messages.pop();
          return { success: false, content: "", error: "请求已取消" };
        }
        lastError = this.formatError(err);
        // CORS 类错误不重试（重试也无法解决）
        if (this.isCorsLikeError(err)) break;
        if (attempt < this.retryCount) {
          await this.delay(this.retryDelay);
        }
      }
    }

    this.messages.pop();
    aiHistoryManager.addRecord({
      userPrompt: userPrompt || userMessage,
      actualMessage: userMessage,
      response: "",
      success: false,
      error: lastError,
    });
    return { success: false, content: "", error: lastError };
  }

  /**
   * 发送消息（流式响应）
   */
  async sendStream(
    userMessage: string,
    onChunk: StreamCallback,
    userPrompt?: string,
  ): Promise<ChatResult> {
    const configError = await this.validateConfig();
    if (configError) {
      aiHistoryManager.addRecord({
        userPrompt: userPrompt || userMessage,
        actualMessage: userMessage,
        response: "",
        success: false,
        error: configError,
      });
      return { success: false, content: "", error: configError };
    }

    this.addMessage("user", userMessage);
    const config = await this.getConfig();
    const provider = getProvider(config.type);

    let lastError = "";
    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      try {
        this.abortController = new AbortController();
        const request = provider.buildRequest(this.messages, config, {
          stream: true,
        });

        const response = await this.executeRequest(
          request,
          this.abortController.signal,
        );

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("无法获取响应流");
        }

        const decoder = new TextDecoder();
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            const delta = provider.parseStreamChunk(line);
            if (delta === null) {
              onChunk("", true);
              continue;
            }
            if (delta) {
              fullContent += delta;
              onChunk(delta, false);
            }
          }
        }

        this.addMessage("assistant", fullContent);
        const finalUsage = this.estimateTokenUsage(
          this.messages.map((m) => m.content).join(" "),
          fullContent,
        );

        aiHistoryManager.addRecord({
          userPrompt: userPrompt || userMessage,
          actualMessage: userMessage,
          response: fullContent,
          success: true,
          textContent: userMessage,
          tokenUsage: finalUsage,
        });
        return { success: true, content: fullContent };
      } catch (err: any) {
        if (err.name === "AbortError") {
          this.messages.pop();
          return { success: false, content: "", error: "请求已取消" };
        }
        lastError = this.formatError(err);
        if (this.isCorsLikeError(err)) break;
        if (attempt < this.retryCount) {
          await this.delay(this.retryDelay);
        }
      }
    }

    this.messages.pop();
    aiHistoryManager.addRecord({
      userPrompt: userPrompt || userMessage,
      actualMessage: userMessage,
      response: "",
      success: false,
      error: lastError,
    });
    return { success: false, content: "", error: lastError };
  }

  /**
   * 发送带图片的消息（Vision）
   */
  async sendVision(
    textContent: string,
    imageBase64: string,
    userPrompt?: string,
  ): Promise<ChatResult> {
    const configError = await this.validateConfig();
    if (configError) {
      aiHistoryManager.addRecord({
        userPrompt: userPrompt || textContent,
        actualMessage: textContent,
        response: "",
        success: false,
        error: configError,
        hasImage: true,
        imageBase64,
        imageDescription: "设备截图",
        textContent,
      });
      return { success: false, content: "", error: configError };
    }

    this.addMessage("user", textContent);
    const config = await this.getConfig();
    const provider = getProvider(config.type);

    let lastError = "";
    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      try {
        this.abortController = new AbortController();
        const request = provider.buildRequest(this.messages, config, {
          stream: false,
          images: [{ base64: imageBase64, mimeType: "image/png" }],
        });

        const response = await this.executeRequest(
          request,
          this.abortController.signal,
        );

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const { content, usage } = provider.parseResponse(data);
        this.addMessage("assistant", content);

        const finalUsage =
          usage ||
          this.estimateTokenUsage(
            this.messages.map((m) => m.content).join(" "),
            content,
          );

        aiHistoryManager.addRecord({
          userPrompt: userPrompt || textContent,
          actualMessage: textContent,
          response: content,
          success: true,
          hasImage: true,
          imageBase64,
          imageDescription: "设备截图",
          textContent,
          tokenUsage: finalUsage,
        });

        return { success: true, content };
      } catch (err: any) {
        if (err.name === "AbortError") {
          this.messages.pop();
          return { success: false, content: "", error: "请求已取消" };
        }
        lastError = this.formatError(err);
        if (this.isCorsLikeError(err)) break;
        if (attempt < this.retryCount) {
          await this.delay(this.retryDelay);
        }
      }
    }

    this.messages.pop();
    aiHistoryManager.addRecord({
      userPrompt: userPrompt || textContent,
      actualMessage: textContent,
      response: "",
      success: false,
      error: lastError,
      hasImage: true,
      imageBase64,
      imageDescription: "设备截图",
      textContent,
    });
    return { success: false, content: "", error: lastError };
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
