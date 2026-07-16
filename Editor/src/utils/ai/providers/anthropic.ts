/**
 * Anthropic (Claude) Provider 实现
 * 支持 Anthropic Messages API
 *
 * 关键差异：
 * - system prompt 放在顶层 system 字段而非 messages 中
 * - 认证使用 x-api-key header + anthropic-version header
 * - Vision 使用 content blocks 中 type: "image" + source.type: "base64"
 * - 流式使用 SSE event 字段区分事件类型
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

/** Anthropic 内容块 */
type AnthropicContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: {
        type: "base64";
        media_type: string;
        data: string;
      };
    };

/** Anthropic 消息格式 */
interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

/**
 * 将统一消息转换为 Anthropic 格式
 * 提取 system prompt，其余消息转换角色
 */
function toAnthropicMessages(
  messages: UnifiedMessage[],
  images?: VisionImage[],
): { system?: string; messages: AnthropicMessage[] } {
  let system: string | undefined;
  const result: AnthropicMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.role === "system") {
      // Anthropic 的 system prompt 放在顶层
      system = msg.content;
      continue;
    }

    // 如果是最后一条用户消息且有图片，构建 content blocks
    if (images?.length && msg.role === "user" && i === messages.length - 1) {
      const content: AnthropicContentBlock[] = [
        { type: "text", text: msg.content },
        ...images.map((img) => ({
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: img.mimeType,
            data: img.base64,
          },
        })),
      ];
      result.push({ role: msg.role, content });
    } else {
      result.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }
  }

  return { system, messages: result };
}

export const anthropicProvider: AIProvider = {
  type: "anthropic",
  displayName: "Claude (Anthropic)",
  defaultBaseUrl: "https://api.anthropic.com",
  models: [
    "claude-sonnet-4-20250514",
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest",
    "claude-3-opus-latest",
  ],
  visionModels: [
    "claude-sonnet-4-20250514",
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest",
    "claude-3-opus-latest",
  ],

  buildRequest(
    messages: UnifiedMessage[],
    config: AIProviderConfig,
    options?: RequestOptions,
  ): ProviderRequest {
    const baseUrl = config.apiUrl.replace(/\/+$/, "");
    const url = `${baseUrl}/v1/messages`;

    const { system, messages: anthropicMsgs } = toAnthropicMessages(
      messages,
      options?.images,
    );

    const body: Record<string, any> = {
      model: config.model,
      messages: anthropicMsgs,
      temperature: config.temperature,
      max_tokens: 4096,
      stream: options?.stream ?? false,
    };

    if (system) {
      body.system = system;
    }

    return {
      url,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    };
  },

  parseResponse(responseBody: any) {
    // Anthropic 响应格式：content 是数组，取第一个 text block
    let content = "";
    if (Array.isArray(responseBody.content)) {
      for (const block of responseBody.content) {
        if (block.type === "text") {
          content += block.text;
        }
      }
    }

    let usage: TokenUsage | undefined;
    if (responseBody.usage) {
      usage = {
        promptTokens: responseBody.usage.input_tokens || 0,
        completionTokens: responseBody.usage.output_tokens || 0,
        totalTokens:
          (responseBody.usage.input_tokens || 0) +
          (responseBody.usage.output_tokens || 0),
        isEstimated: false,
      };
    }

    return { content, usage };
  },

  parseStreamChunk(line: string): string | null {
    // Anthropic 流式格式：
    // event: content_block_delta
    // data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"..."}}
    // event: message_stop

    if (line.startsWith("event: ")) {
      const event = line.slice(7).trim();
      if (event === "message_stop") return null;
      return "";
    }

    if (!line.startsWith("data: ")) return "";
    const data = line.slice(6).trim();

    try {
      const parsed = JSON.parse(data);
      if (parsed.type === "content_block_delta" && parsed.delta?.text) {
        return parsed.delta.text;
      }
      return "";
    } catch {
      return "";
    }
  },

  parseStreamUsage(finalData: any): TokenUsage | undefined {
    if (finalData?.usage) {
      return {
        promptTokens: finalData.usage.input_tokens || 0,
        completionTokens: finalData.usage.output_tokens || 0,
        totalTokens:
          (finalData.usage.input_tokens || 0) +
          (finalData.usage.output_tokens || 0),
        isEstimated: false,
      };
    }
    return undefined;
  },
};
