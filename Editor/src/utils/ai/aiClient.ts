import { useConfigStore } from "../../stores/configStore";
import { decryptApiKey } from "./crypto";
import {
  getProvider,
  type AIProviderConfig,
  type AIProviderType,
  type ProviderRequest,
  type TokenUsage,
  type UnifiedMessage,
  type VisionImage,
} from "./providers";
import { aiProtocol, localServer } from "../../services/server";

export interface AIClientOptions {
  retryCount?: number;
  retryDelay?: number;
}

export interface AIRequestOptions {
  images?: VisionImage[];
  signal?: AbortSignal;
}

export type StreamCallback = (chunk: string, done: boolean) => void;

export interface AICompletionResult {
  success: boolean;
  content: string;
  error?: string;
  usage?: TokenUsage;
}

/**
 * 无状态模型 API 请求层。
 * 调用方负责维护消息上下文，本类只处理请求执行和响应解析。
 */
export class AIClient {
  private readonly retryCount: number;
  private readonly retryDelay: number;
  private abortController: AbortController | null = null;
  private streamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private aborted = false;

  constructor(options: AIClientOptions = {}) {
    this.retryCount = options.retryCount ?? 2;
    this.retryDelay = options.retryDelay ?? 1000;
  }

  private async getConfig(): Promise<AIProviderConfig> {
    const configs = useConfigStore.getState().configs;
    return {
      type: (configs.aiProviderType as AIProviderType) || "openai",
      apiUrl: configs.aiApiUrl,
      apiKey: await decryptApiKey(configs.aiApiKey),
      model: configs.aiModel,
      temperature: configs.aiTemperature,
    };
  }

  private async validateConfig(): Promise<string | null> {
    const config = await this.getConfig();
    if (!config.apiUrl) return "API URL 未配置";
    if (!config.apiKey) return "API Key 未配置";
    if (!config.model) return "模型名称未配置";
    return null;
  }

  private shouldUseProxy(): boolean {
    const { aiUseProxy } = useConfigStore.getState().configs;
    return Boolean(aiUseProxy && localServer.isConnected());
  }

  private isCorsLikeError(error: unknown): boolean {
    if (this.shouldUseProxy()) return false;
    return (
      error instanceof TypeError &&
      ["Failed to fetch", "NetworkError when attempting to fetch resource."].some(
        (message) => error.message.includes(message),
      )
    );
  }

  private formatError(error: unknown): string {
    if (this.isCorsLikeError(error)) {
      return "请求失败，可能是浏览器跨域限制。请开启 LocalBridge 代理，或确认 API 服务允许当前域访问。";
    }
    return error instanceof Error ? error.message : String(error);
  }

  private async executeRequest(
    request: ProviderRequest,
    signal?: AbortSignal,
  ): Promise<Response> {
    if (this.shouldUseProxy()) {
      const result = await aiProtocol.sendProxyRequest(request, signal);
      return new Response(result.body, {
        status: result.status,
        headers: result.headers,
      });
    }
    return fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal,
    });
  }

  private async executeStreamRequest(
    request: ProviderRequest,
    signal?: AbortSignal,
  ): Promise<ReadableStream<Uint8Array>> {
    if (this.shouldUseProxy()) {
      const stream = aiProtocol.sendStreamProxyRequest(request).stream;
      if (signal?.aborted) {
        await stream.cancel();
        const error = new Error("请求已取消");
        error.name = "AbortError";
        throw error;
      }
      return stream;
    }
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    if (!response.body) throw new Error("无法获取响应流");
    return response.body;
  }

  private estimateTokenUsage(
    messages: UnifiedMessage[],
    completion: string,
  ): TokenUsage {
    const estimateTokens = (value: string) => Math.ceil(value.length / 1.3);
    const promptTokens = estimateTokens(messages.map((item) => item.content).join(" "));
    const completionTokens = estimateTokens(completion);
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      isEstimated: true,
    };
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  private createRequestController(externalSignal?: AbortSignal): {
    controller: AbortController;
    cleanup: () => void;
  } {
    const controller = new AbortController();
    const handleExternalAbort = () => {
      this.aborted = true;
      controller.abort();
      void this.streamReader?.cancel();
    };

    this.abortController = controller;
    if (externalSignal?.aborted) {
      handleExternalAbort();
    } else {
      externalSignal?.addEventListener("abort", handleExternalAbort, {
        once: true,
      });
    }

    return {
      controller,
      cleanup: () => {
        externalSignal?.removeEventListener("abort", handleExternalAbort);
        if (this.abortController === controller) {
          this.abortController = null;
        }
      },
    };
  }

  async complete(
    messages: UnifiedMessage[],
    options: AIRequestOptions = {},
  ): Promise<AICompletionResult> {
    this.aborted = false;
    const configError = await this.validateConfig();
    if (configError) return { success: false, content: "", error: configError };

    const config = await this.getConfig();
    const provider = getProvider(config.type);
    let lastError = "";
    if (this.aborted || options.signal?.aborted) {
      return { success: false, content: "", error: "请求已取消" };
    }

    for (let attempt = 0; attempt <= this.retryCount; attempt += 1) {
      const { controller, cleanup } = this.createRequestController(
        options.signal,
      );
      try {
        const request = provider.buildRequest(messages, config, {
          stream: false,
          images: options.images,
        });
        const response = await this.executeRequest(request, controller.signal);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        const { content, usage } = provider.parseResponse(await response.json());
        cleanup();
        return {
          success: true,
          content,
          usage: usage ?? this.estimateTokenUsage(messages, content),
        };
      } catch (error) {
        if (
          this.aborted ||
          (error instanceof Error && error.name === "AbortError")
        ) {
          cleanup();
          return { success: false, content: "", error: "请求已取消" };
        }
        lastError = this.formatError(error);
        if (this.isCorsLikeError(error) || attempt >= this.retryCount) {
          cleanup();
          break;
        }
        await this.delay(this.retryDelay);
        cleanup();
        if (this.aborted) {
          return { success: false, content: "", error: "请求已取消" };
        }
      }
    }

    return { success: false, content: "", error: lastError };
  }

  async stream(
    messages: UnifiedMessage[],
    onChunk: StreamCallback,
    options: AIRequestOptions = {},
  ): Promise<AICompletionResult> {
    this.aborted = false;
    const configError = await this.validateConfig();
    if (configError) return { success: false, content: "", error: configError };

    const config = await this.getConfig();
    const provider = getProvider(config.type);
    let lastError = "";
    if (this.aborted || options.signal?.aborted) {
      return { success: false, content: "", error: "请求已取消" };
    }

    for (let attempt = 0; attempt <= this.retryCount; attempt += 1) {
      const { controller, cleanup } = this.createRequestController(
        options.signal,
      );
      let content = "";
      try {
        const request = provider.buildRequest(messages, config, {
          stream: true,
          images: options.images,
        });
        const stream = await this.executeStreamRequest(
          request,
          controller.signal,
        );
        const reader = stream.getReader();
        this.streamReader = reader;

        const decoder = new TextDecoder();
        let buffer = "";
        let streamDone = false;
        const processLine = (line: string) => {
          if (streamDone || !line.trim()) return;
          const delta = provider.parseStreamChunk(line);
          if (delta === null) {
            if (!streamDone) onChunk("", true);
            streamDone = true;
          } else if (delta) {
            content += delta;
            onChunk(delta, false);
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";
          lines.forEach(processLine);
        }
        buffer += decoder.decode();
        if (this.aborted) {
          this.streamReader = null;
          cleanup();
          return { success: false, content: "", error: "请求已取消" };
        }
        processLine(buffer);
        if (!streamDone) onChunk("", true);
        this.streamReader = null;
        cleanup();
        return {
          success: true,
          content,
          usage: this.estimateTokenUsage(messages, content),
        };
      } catch (error) {
        this.streamReader = null;
        if (
          this.aborted ||
          (error instanceof Error && error.name === "AbortError")
        ) {
          cleanup();
          return { success: false, content: "", error: "请求已取消" };
        }
        lastError = this.formatError(error);
        if (
          content ||
          this.isCorsLikeError(error) ||
          attempt >= this.retryCount
        ) {
          cleanup();
          break;
        }
        await this.delay(this.retryDelay);
        cleanup();
        if (this.aborted) {
          return { success: false, content: "", error: "请求已取消" };
        }
      }
    }

    return { success: false, content: "", error: lastError };
  }

  abort(): void {
    this.aborted = true;
    this.abortController?.abort();
    void this.streamReader?.cancel();
    this.abortController = null;
    this.streamReader = null;
  }
}
