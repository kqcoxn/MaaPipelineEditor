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
  UnifiedFinishReason,
  UnifiedResponse,
} from "./types";

/** OpenAI 消息内容（Vision） */
interface OpenAIVisionContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string; detail?: string };
}

/** OpenAI 消息格式 */
interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | OpenAIVisionContent[] | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

const CHAT_COMPLETIONS_PATH = "/chat/completions";
const DEFAULT_CHAT_COMPLETIONS_PATH = "/v1/chat/completions";

/**
 * 兼容三类常见配置：
 * - https://api.openai.com -> /v1/chat/completions
 * - https://api.openai.com/v1 或第三方 /api/paas/v4 -> /chat/completions
 * - 已填写完整 /chat/completions 端点时保持不重复拼接
 */
export function resolveOpenAICompatibleChatUrl(apiUrl: string): string {
  const url = new URL(apiUrl.trim());
  const pathname = url.pathname.replace(/\/+$/, "");

  if (pathname.endsWith(CHAT_COMPLETIONS_PATH)) {
    url.pathname = pathname;
    return url.toString();
  }

  url.pathname =
    pathname === ""
      ? DEFAULT_CHAT_COMPLETIONS_PATH
      : `${pathname}${CHAT_COMPLETIONS_PATH}`;
  return url.toString();
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

    if (msg.role === "tool") {
      result.push({
        role: "tool",
        content: msg.content,
        tool_call_id: msg.toolCallId,
        name: msg.name,
      });
      continue;
    }

    if (msg.role === "assistant" && msg.toolCalls?.length) {
      result.push({
        role: "assistant",
        content: msg.content || null,
        tool_calls: msg.toolCalls.map((toolCall) => ({
          id: toolCall.id,
          type: "function",
          function: {
            name: toolCall.name,
            arguments: JSON.stringify(toolCall.arguments),
          },
        })),
      });
      continue;
    }

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
    const url = resolveOpenAICompatibleChatUrl(config.apiUrl);

    const openaiMessages = toOpenAIMessages(messages, options?.images);

    const body: Record<string, any> = {
      model: config.model,
      messages: openaiMessages,
      temperature: config.temperature,
      stream: options?.stream ?? false,
    };

    if (options?.stream) {
      body.stream_options = { include_usage: true };
    }
    if (options?.tools?.length) {
      body.tools = options.tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
          strict: true,
        },
      }));
      const choice = options.toolChoice ?? "auto";
      body.tool_choice =
        typeof choice === "object"
          ? { type: "function", function: { name: choice.name } }
          : choice;
    }

    return {
      url,
      method: "POST",
      stream: options?.stream ?? false,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    };
  },

  parseResponse(responseBody: any): UnifiedResponse {
    const choice = responseBody.choices?.[0];
    const content = choice?.message?.content || "";
    const reasoning = readOpenAIReasoning(choice?.message);
    const toolCalls = (choice?.message?.tool_calls ?? []).map(
      (toolCall: any, index: number) => ({
        id: toolCall.id || `openai_tool_${index}`,
        name: toolCall.function?.name || "",
        arguments: parseToolArguments(toolCall.function?.arguments),
      }),
    );
    let usage: TokenUsage | undefined;

    if (
      typeof responseBody.usage?.prompt_tokens === "number" &&
      typeof responseBody.usage?.completion_tokens === "number"
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

    return {
      success: true,
      content,
      reasoning: reasoning || undefined,
      toolCalls,
      finishReason: mapOpenAIFinishReason(choice?.finish_reason, toolCalls.length),
      usage,
    };
  },

  parseStreamEvent(event) {
    if (!event.data || event.data === "[DONE]") {
      return { done: event.data === "[DONE]" };
    }
    try {
      const parsed = JSON.parse(event.data);
      const choice = parsed.choices?.[0];
      const delta = choice?.delta;
      return {
        content: delta?.content || undefined,
        reasoning: readOpenAIReasoning(delta) || undefined,
        toolCalls: delta?.tool_calls?.map((toolCall: any) => ({
          index: toolCall.index ?? 0,
          id: toolCall.id,
          name: toolCall.function?.name,
          argumentsDelta: toolCall.function?.arguments,
        })),
        finishReason: choice?.finish_reason
          ? mapOpenAIFinishReason(choice.finish_reason, 0)
          : undefined,
        usage: parsed.usage
          ? {
              promptTokens: parsed.usage.prompt_tokens || 0,
              completionTokens: parsed.usage.completion_tokens || 0,
              totalTokens: parsed.usage.total_tokens || 0,
              isEstimated: false,
            }
          : undefined,
      };
    } catch {
      return {};
    }
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

  parseStreamUsage(finalData: any): TokenUsage | undefined {
    const usage = finalData?.usage;
    if (!usage) return undefined;

    return {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens:
        usage.total_tokens ||
        (usage.prompt_tokens || 0) + (usage.completion_tokens || 0),
      isEstimated: false,
    };
  },
};

function readOpenAIReasoning(value: any): string {
  const reasoning = value?.reasoning_content ?? value?.reasoning;
  return typeof reasoning === "string" ? reasoning : "";
}

function parseToolArguments(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function mapOpenAIFinishReason(
  reason: unknown,
  toolCallCount: number,
): UnifiedFinishReason {
  if (reason === "tool_calls" || toolCallCount > 0) return "tool_calls";
  if (reason === "stop") return "stop";
  if (reason === "length") return "length";
  return "unknown";
}
