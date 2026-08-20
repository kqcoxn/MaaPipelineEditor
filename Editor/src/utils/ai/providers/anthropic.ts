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
  UnifiedFinishReason,
  UnifiedResponse,
} from "./types";

/** Anthropic 内容块 */
type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
    }
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
      system = system ? `${system}\n\n${msg.content}` : msg.content;
      continue;
    }

    if (msg.role === "tool") {
      result.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.toolCallId || "",
            content: msg.content,
          },
        ],
      });
      continue;
    }

    if (msg.role === "assistant" && msg.toolCalls?.length) {
      result.push({
        role: "assistant",
        content: [
          ...(msg.content ? [{ type: "text" as const, text: msg.content }] : []),
          ...msg.toolCalls.map((toolCall) => ({
            type: "tool_use" as const,
            id: toolCall.id,
            name: toolCall.name,
            input: toolCall.arguments,
          })),
        ],
      });
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
    if (options?.tools?.length) {
      body.tools = options.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      }));
      const choice = options.toolChoice ?? "auto";
      body.tool_choice =
        typeof choice === "object"
          ? { type: "tool", name: choice.name }
          : choice === "required"
            ? { type: "any" }
            : { type: choice };
    }

    return {
      url,
      method: "POST",
      stream: options?.stream ?? false,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    };
  },

  parseResponse(responseBody: any): UnifiedResponse {
    let content = "";
    let reasoning = "";
    const toolCalls = [];
    if (Array.isArray(responseBody.content)) {
      for (const block of responseBody.content) {
        if (block.type === "text") {
          content += block.text;
        } else if (block.type === "thinking") {
          reasoning += block.thinking || "";
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id || `anthropic_tool_${toolCalls.length}`,
            name: block.name || "",
            arguments:
              block.input && typeof block.input === "object" ? block.input : {},
          });
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

    return {
      success: true,
      content,
      reasoning: reasoning || undefined,
      toolCalls,
      finishReason: mapAnthropicFinishReason(responseBody.stop_reason),
      usage,
    };
  },

  parseStreamEvent(event) {
    if (event.event === "message_stop") return { done: true };
    if (!event.data) return {};
    try {
      const parsed = JSON.parse(event.data);
      if (parsed.type === "content_block_start" && parsed.content_block?.type === "tool_use") {
        return {
          toolCalls: [
            {
              index: parsed.index ?? 0,
              id: parsed.content_block.id,
              name: parsed.content_block.name,
              argumentsDelta: JSON.stringify(parsed.content_block.input ?? {}).replace("{}", ""),
            },
          ],
        };
      }
      if (parsed.type === "content_block_delta") {
        if (parsed.delta?.type === "text_delta") {
          return { content: parsed.delta.text || undefined };
        }
        if (parsed.delta?.type === "thinking_delta") {
          return { reasoning: parsed.delta.thinking || undefined };
        }
        if (parsed.delta?.type === "input_json_delta") {
          return {
            toolCalls: [
              {
                index: parsed.index ?? 0,
                argumentsDelta: parsed.delta.partial_json || "",
              },
            ],
          };
        }
      }
      if (parsed.type === "message_delta") {
        return {
          finishReason: mapAnthropicFinishReason(parsed.delta?.stop_reason),
          usage: this.parseStreamUsage?.(parsed),
        };
      }
      return { usage: this.parseStreamUsage?.(parsed) };
    } catch {
      return {};
    }
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
    const usage = finalData?.message?.usage ?? finalData?.usage;
    if (usage) {
      return {
        promptTokens: usage.input_tokens || 0,
        completionTokens: usage.output_tokens || 0,
        totalTokens:
          (usage.input_tokens || 0) + (usage.output_tokens || 0),
        isEstimated: false,
      };
    }
    return undefined;
  },

  mergeStreamUsage(current, next) {
    if (!current) return next;

    const promptTokens = Math.max(current.promptTokens, next.promptTokens);
    const completionTokens = Math.max(
      current.completionTokens,
      next.completionTokens,
    );
    return {
      promptTokens,
      completionTokens,
      totalTokens: Math.max(
        current.totalTokens,
        next.totalTokens,
        promptTokens + completionTokens,
      ),
      isEstimated: current.isEstimated && next.isEstimated,
    };
  },
};

function mapAnthropicFinishReason(reason: unknown): UnifiedFinishReason {
  if (reason === "tool_use") return "tool_calls";
  if (reason === "end_turn" || reason === "stop_sequence") return "stop";
  if (reason === "max_tokens") return "length";
  return "unknown";
}
