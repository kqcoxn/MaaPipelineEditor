import { useConfigStore } from "../../stores/configStore";

/** 消息角色类型 */
export type MessageRole = "system" | "user" | "assistant";

/** Vision 内容类型 */
export interface VisionContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

/** 消息结构 */
export interface ChatMessage {
  role: MessageRole;
  content: string | VisionContent[];
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

/** 全局对话历史记录项 */
export interface AIHistoryRecord {
  id: string;
  timestamp: number;
  userPrompt: string;
  actualMessage: string;
  response: string;
  success: boolean;
  error?: string;
  hasImage?: boolean; // 是否包含图片
  imageBase64?: string; // 图片base64(用于缩略图)
  imageDescription?: string; // 图片描述(如"设备截图")
  textContent?: string; // 实际发送的文本内容
  tokenUsage?: {
    // Token用量统计
    promptTokens: number; // 输入token
    completionTokens: number; // 输出token
    totalTokens: number; // 总token
    isEstimated: boolean; // 是否为估算值
  };
}

/** 全局历史记录管理 */
class AIHistoryManager {
  private records: AIHistoryRecord[] = [];
  private listeners: Set<() => void> = new Set();

  /** 添加历史记录 */
  addRecord(record: Omit<AIHistoryRecord, "id" | "timestamp">) {
    const newRecord: AIHistoryRecord = {
      ...record,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    this.records.unshift(newRecord);
    this.notifyListeners();
  }

  /** 获取所有记录 */
  getRecords(): AIHistoryRecord[] {
    return [...this.records];
  }

  /** 清空记录 */
  clearRecords() {
    this.records = [];
    this.notifyListeners();
  }

  /** 订阅变化 */
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 通知监听者 */
  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }
}

/** 全局历史记录管理器实例 */
export const aiHistoryManager = new AIHistoryManager();

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
    const { aiApiUrl, aiApiKey, aiModel, aiTemperature } =
      useConfigStore.getState().configs;
    return {
      apiUrl: aiApiUrl,
      apiKey: aiApiKey,
      model: aiModel,
      temperature: aiTemperature,
    };
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
    const { model, temperature } = this.getApiConfig();
    return {
      model,
      messages: this.messages,
      temperature,
      stream,
    };
  }

  /** 添加消息并维护历史记录上限 */
  private addMessage(role: MessageRole, content: string) {
    this.messages.push({ role, content });
    this.trimHistory();
  }

  /** 添加 Vision 消息 */
  private addVisionMessage(role: MessageRole, content: VisionContent[]) {
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
   * 发送消息（非流式）
   * @param userMessage 实际发送给AI的消息内容
   * @param userPrompt 用户原始输入（用于历史记录显示，可选）
   */
  async send(userMessage: string, userPrompt?: string): Promise<ChatResult> {
    const configError = this.validateConfig();
    if (configError) {
      // 记录失败的历史
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

        // 记录成功的历史
        aiHistoryManager.addRecord({
          userPrompt: userPrompt || userMessage,
          actualMessage: userMessage,
          response: content,
          success: true,
          textContent: userMessage,
          tokenUsage: this.extractTokenUsage(data),
        });

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
    // 记录失败的历史
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
   * @param userMessage 实际发送给AI的消息内容
   * @param onChunk 流式响应回调
   * @param userPrompt 用户原始输入（用于历史记录显示，可选）
   */
  async sendStream(
    userMessage: string,
    onChunk: StreamCallback,
    userPrompt?: string,
  ): Promise<ChatResult> {
    const configError = this.validateConfig();
    if (configError) {
      // 记录失败的历史
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
        // 记录成功的历史
        aiHistoryManager.addRecord({
          userPrompt: userPrompt || userMessage,
          actualMessage: userMessage,
          response: fullContent,
          success: true,
          textContent: userMessage,
          tokenUsage: this.extractTokenUsage({
            usage: null, // 流式响应通常不包含 usage
            choices: [{ message: { content: fullContent } }],
          }),
        });
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
    // 记录失败的历史
    aiHistoryManager.addRecord({
      userPrompt: userPrompt || userMessage,
      actualMessage: userMessage,
      response: "",
      success: false,
      error: lastError,
    });
    return { success: false, content: "", error: lastError };
  }

  /** 取消当前请求 */
  abort() {
    this.abortController?.abort();
    this.abortController = null;
  }

  /**
   * 从 API 响应中提取 token 用量
   * 如果 API 未返回则估算
   */
  private extractTokenUsage(data: any): AIHistoryRecord["tokenUsage"] {
    // 尝试获取真实用量
    const usage = data.usage;
    if (usage?.prompt_tokens && usage?.completion_tokens) {
      return {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens:
          usage.total_tokens || usage.prompt_tokens + usage.completion_tokens,
        isEstimated: false,
      };
    }

    // 估算: 大约 1 token ≈ 1.3 个中文字符或 0.75 个英文单词
    const estimateTokens = (text: string) => Math.ceil(text.length / 1.3);
    const promptText = this.messages
      .map((m) => (typeof m.content === "string" ? m.content : ""))
      .join(" ");
    const completionText = data.choices?.[0]?.message?.content || "";

    const promptTokens = estimateTokens(promptText);
    const completionTokens = estimateTokens(completionText);

    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      isEstimated: true,
    };
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

  /**
   * 发送带图片的消息（Vision）
   * @param textContent 文本内容
   * @param imageBase64 图片 base64（不含前缀）
   * @param userPrompt 用户原始输入（用于历史记录显示，可选）
   */
  async sendVision(
    textContent: string,
    imageBase64: string,
    userPrompt?: string,
  ): Promise<ChatResult> {
    const configError = this.validateConfig();
    if (configError) {
      aiHistoryManager.addRecord({
        userPrompt: userPrompt || textContent,
        actualMessage: textContent,
        response: "",
        success: false,
        error: configError,
        hasImage: true,
        imageBase64: imageBase64,
        imageDescription: "设备截图",
        textContent: textContent,
      });
      return { success: false, content: "", error: configError };
    }

    // 构建 vision 消息内容
    const visionContent: VisionContent[] = [
      { type: "text", text: textContent },
      {
        type: "image_url",
        image_url: { url: `data:image/png;base64,${imageBase64}` },
      },
    ];

    this.addVisionMessage("user", visionContent);
    const { apiUrl, apiKey, temperature } = this.getApiConfig();

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
          body: JSON.stringify({
            model: useConfigStore.getState().configs.aiModel,
            messages: this.messages,
            temperature,
            stream: false,
          }),
          signal: this.abortController.signal,
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        this.addMessage("assistant", content);

        // 记录成功的历史
        aiHistoryManager.addRecord({
          userPrompt: userPrompt || textContent,
          actualMessage: textContent,
          response: content,
          success: true,
          hasImage: true,
          imageBase64: imageBase64,
          imageDescription: "设备截图",
          textContent: textContent,
          tokenUsage: this.extractTokenUsage(data),
        });

        return { success: true, content };
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
    aiHistoryManager.addRecord({
      userPrompt: userPrompt || textContent,
      actualMessage: textContent,
      response: "",
      success: false,
      error: lastError,
      hasImage: true,
      imageBase64: imageBase64,
      imageDescription: "设备截图",
      textContent: textContent,
    });
    return { success: false, content: "", error: lastError };
  }
}
