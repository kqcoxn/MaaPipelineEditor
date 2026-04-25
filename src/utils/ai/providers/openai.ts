/**
 * OpenAI Provider 实现
 * 支持 OpenAI Chat Completions API 及其兼容服务
 */

import type {
  AIProvider,
  AIProviderConfig,
  UnifiedMessage,
  VisionImage,
  ProviderRequest,
  RequestOptions,
  TokenUsage,
} from "./types";

/** OpenAI 消息内容（Vision） */
interface OpenAIVisionContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string; detail?: string };
}

/** OpenAI 消息格式 */
interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string | OpenAIVisionContent[];
}

/**
 * 将统一消息格式转换为 OpenAI 消息格式
 */
function toOpenAIMessages(
  messages: UnifiedMessage[],
  images?: VisionImage[],
): OpenAIMessage[] {
  const result: OpenAIMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // 如果是最后一条用户消息且有图片，构建 Vision 内容
    if (images?.length && msg.role === "user" && i === messages.length - 1) {
      const content: OpenAIVisionContent[] = [
        { type: "text", text: msg.content },
        ...images.map((img) => ({
          type: "image_url" as const,
          image_url: {
            url: `data:${img.mimeType};base64,${img.base64}`,
          },
        })),
      ];
      result.push({ role: msg.role, content });
    } else {
      result.push({ role: msg.role, content: msg.content });
    }
  }

  return result;
}

export const openaiProvider: AIProvider = {
  type: "openai",
  displayName: "OpenAI",
  defaultBaseUrl: "https://api.openai.com",
  models: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "o3",
    "o4-mini",
  ],
  visionModels: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4.1",
    "gpt-4.1-mini",
    "o3",
    "o4-mini",
  ],

  buildRequest(
    messages: UnifiedMessage[],
    config: AIProviderConfig,
    options?: RequestOptions,
  ): ProviderRequest {
    const baseUrl = config.apiUrl.replace(/\/+$/, "");
    const url = `${baseUrl}/v1/chat/completions`;

    const openaiMessages = toOpenAIMessages(messages, options?.images);

    const body: Record<string, any> = {
      model: config.model,
      messages: openaiMessages,
      temperature: config.temperature,
      stream: options?.stream ?? false,
    };

    return {
      url,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    };
  },

  parseResponse(responseBody: any) {
    const content = responseBody.choices?.[0]?.message?.content || "";
    let usage: TokenUsage | undefined;

    if (
      responseBody.usage?.prompt_tokens &&
      responseBody.usage?.completion_tokens
    ) {
      usage = {
        promptTokens: responseBody.usage.prompt_tokens,
        completionTokens: responseBody.usage.completion_tokens,
        totalTokens:
          responseBody.usage.total_tokens ||
          responseBody.usage.prompt_tokens +
            responseBody.usage.completion_tokens,
        isEstimated: false,
      };
    }

    return { content, usage };
  },

  parseStreamChunk(line: string): string | null {
    if (!line.startsWith("data: ")) return "";
    const data = line.slice(6).trim();
    if (data === "[DONE]") return null;

    try {
      const parsed = JSON.parse(data);
      return parsed.choices?.[0]?.delta?.content || "";
    } catch {
      return "";
    }
  },
};
