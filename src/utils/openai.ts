import { useConfigStore } from "../stores/configStore";

/** 消息角色类型 */
export type MessageRole = "system" | "user" | "assistant";

/** 消息结构 */
export interface ChatMessage {
  role: MessageRole;
  content: string;
}

/** 创建对话实例的配置项 */
export interface OpenAIChatOptions {
  /** 系统提示词 */
  systemPrompt?: string;
  /** 保留的历史记录轮数，默认 10 */
  historyLimit?: number;
  /** 重试次数，默认 2 */
  retryCount?: number;
  /** 重试间隔(ms)，默认 1000 */
  retryDelay?: number;
  /** 温度参数，默认 0.7 */
  temperature?: number;
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
 * OpenAI 对话管理类
 * 每个实例独立管理上下文
 */
export class OpenAIChat {
  private messages: ChatMessage[] = [];
  private systemPrompt: string;
  private historyLimit: number;
  private retryCount: number;
  private retryDelay: number;
  private temperature: number;
  private abortController: AbortController | null = null;

  constructor(options: OpenAIChatOptions = {}) {
    this.systemPrompt = options.systemPrompt || "";
    this.historyLimit = options.historyLimit ?? 10;
    this.retryCount = options.retryCount ?? 2;
    this.retryDelay = options.retryDelay ?? 1000;
    this.temperature = options.temperature ?? 0.7;

    // 初始化系统提示词
    if (this.systemPrompt) {
      this.messages.push({ role: "system", content: this.systemPrompt });
    }
  }

  /** 获取 API 配置 */
  private getApiConfig() {
    const { aiApiUrl, aiApiKey, aiModel } = useConfigStore.getState().configs;
    return { apiUrl: aiApiUrl, apiKey: aiApiKey, model: aiModel };
  }

  /** 校验配置 */
  private validateConfig(): string | null {
    const { apiUrl, apiKey, model } = this.getApiConfig();
    if (!apiUrl) return "API URL 未配置";
    if (!apiKey) return "API Key 未配置";
    if (!model) return "模型名称未配置";
    return null;
  }

  /** 构建请求体 */
  private buildRequestBody(stream: boolean) {
    const { model } = this.getApiConfig();
    return {
      model,
      messages: this.messages,
      temperature: this.temperature,
      stream,
    };
  }

  /** 添加消息并维护历史记录上限 */
  private addMessage(role: MessageRole, content: string) {
    this.messages.push({ role, content });
    this.trimHistory();
  }

  /** 裁剪历史记录 */
  private trimHistory() {
    // 保留系统提示词
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
   * 发送消息（非流式，直接返回完整结果）
   */
  async send(userMessage: string): Promise<ChatResult> {
    const configError = this.validateConfig();
    if (configError) {
      return { success: false, content: "", error: configError };
    }

    this.addMessage("user", userMessage);
    const { apiUrl, apiKey } = this.getApiConfig();

    let lastError = "";
    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      try {
        this.abortController = new AbortController();

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(this.buildRequestBody(false)),
          signal: this.abortController.signal,
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        this.addMessage("assistant", content);

        return { success: true, content };
      } catch (err: any) {
        if (err.name === "AbortError") {
          // 用户主动取消
          this.messages.pop();
          return { success: false, content: "", error: "请求已取消" };
        }
        lastError = err.message || String(err);
        if (attempt < this.retryCount) {
          await this.delay(this.retryDelay);
        }
      }
    }

    // 所有重试失败
    this.messages.pop();
    return { success: false, content: "", error: lastError };
  }

  /**
   * 发送消息（流式响应）
   */
  async sendStream(
    userMessage: string,
    onChunk: StreamCallback
  ): Promise<ChatResult> {
    const configError = this.validateConfig();
    if (configError) {
      return { success: false, content: "", error: configError };
    }

    this.addMessage("user", userMessage);
    const { apiUrl, apiKey } = this.getApiConfig();

    let lastError = "";
    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      try {
        this.abortController = new AbortController();

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(this.buildRequestBody(true)),
          signal: this.abortController.signal,
        });

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
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                onChunk("", true);
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content || "";
                if (delta) {
                  fullContent += delta;
                  onChunk(delta, false);
                }
              } catch {}
            }
          }
        }

        this.addMessage("assistant", fullContent);
        return { success: true, content: fullContent };
      } catch (err: any) {
        if (err.name === "AbortError") {
          this.messages.pop();
          return { success: false, content: "", error: "请求已取消" };
        }
        lastError = err.message || String(err);
        if (attempt < this.retryCount) {
          await this.delay(this.retryDelay);
        }
      }
    }

    this.messages.pop();
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

  /** 获取当前对话历史 */
  getHistory(): ChatMessage[] {
    return [...this.messages];
  }

  /** 更新系统提示词 */
  setSystemPrompt(prompt: string) {
    this.systemPrompt = prompt;
    // 替换或添加系统消息
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
