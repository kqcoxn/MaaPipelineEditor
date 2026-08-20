/**
 * Google Gemini Provider 实现
 * 支持 Gemini GenerateContent API
 *
 * 关键差异：
 * - 端点包含模型名：/v1beta/models/{model}:generateContent
 * - 认证使用 x-goog-api-key header
 * - 消息格式：contents[].parts[]，角色为 user/model
 * - system prompt 通过 systemInstruction 传入
 * - Vision 使用 inlineData { mimeType, data }
 * - 流式端点不同：:streamGenerateContent?alt=sse
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

/** Gemini 内容部分 */
type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | {
      functionResponse: {
        name: string;
        response: Record<string, unknown>;
      };
    };

/** Gemini 内容 */
interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

/**
 * 将统一消息转换为 Gemini 格式
 */
function toGeminiContents(
  messages: UnifiedMessage[],
  images?: VisionImage[],
): { systemInstruction?: { parts: GeminiPart[] }; contents: GeminiContent[] } {
  let systemInstruction: { parts: GeminiPart[] } | undefined;
  const contents: GeminiContent[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.role === "system") {
      const previousText = systemInstruction?.parts
        .map((part) => ("text" in part ? part.text : ""))
        .join("");
      systemInstruction = {
        parts: [
          { text: previousText ? `${previousText}\n\n${msg.content}` : msg.content },
        ],
      };
      continue;
    }

    if (msg.role === "tool") {
      let response: Record<string, unknown> = { result: msg.content };
      try {
        const parsed = JSON.parse(msg.content);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          response = parsed;
        }
      } catch {
        // 文本结果由 result 字段承载。
      }
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: msg.name || "unknown_tool",
              response,
            },
          },
        ],
      });
      continue;
    }

    if (msg.role === "assistant" && msg.toolCalls?.length) {
      contents.push({
        role: "model",
        parts: [
          ...(msg.content ? [{ text: msg.content }] : []),
          ...msg.toolCalls.map((toolCall) => ({
            functionCall: {
              name: toolCall.name,
              args: toolCall.arguments,
            },
          })),
        ],
      });
      continue;
    }

    const role = msg.role === "assistant" ? "model" : "user";

    // 如果是最后一条用户消息且有图片
    if (images?.length && msg.role === "user" && i === messages.length - 1) {
      const parts: GeminiPart[] = [
        { text: msg.content },
        ...images.map((img) => ({
          inlineData: {
            mimeType: img.mimeType,
            data: img.base64,
          },
        })),
      ];
      contents.push({ role, parts });
    } else {
      contents.push({ role, parts: [{ text: msg.content }] });
    }
  }

  return { systemInstruction, contents };
}

export const geminiProvider: AIProvider = {
  type: "gemini",
  displayName: "Gemini (Google)",
  defaultBaseUrl: "https://generativelanguage.googleapis.com",
  models: [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
  ],
  visionModels: [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
  ],

  buildRequest(
    messages: UnifiedMessage[],
    config: AIProviderConfig,
    options?: RequestOptions,
  ): ProviderRequest {
    const baseUrl = config.apiUrl.replace(/\/+$/, "");
    const isStream = options?.stream ?? false;
    const action = isStream
      ? "streamGenerateContent?alt=sse"
      : "generateContent";
    const url = `${baseUrl}/v1beta/models/${config.model}:${action}`;

    const { systemInstruction, contents } = toGeminiContents(
      messages,
      options?.images,
    );

    const body: Record<string, any> = {
      contents,
      generationConfig: {
        temperature: config.temperature,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }
    if (options?.tools?.length) {
      body.tools = [
        {
          functionDeclarations: options.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          })),
        },
      ];
      const choice = options.toolChoice ?? "auto";
      body.toolConfig = {
        functionCallingConfig: {
          mode:
            choice === "none"
              ? "NONE"
              : choice === "required" || typeof choice === "object"
                ? "ANY"
                : "AUTO",
          ...(typeof choice === "object"
            ? { allowedFunctionNames: [choice.name] }
            : {}),
        },
      };
    }

    return {
      url,
      method: "POST",
      stream: isStream,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.apiKey,
      },
      body: JSON.stringify(body),
    };
  },

  parseResponse(responseBody: any): UnifiedResponse {
    let content = "";
    let reasoning = "";
    const toolCalls = [];
    const candidate = responseBody.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text && part.thought === true) {
          reasoning += part.text;
        } else if (part.text) {
          content += part.text;
        } else if (part.functionCall) {
          toolCalls.push({
            id: `gemini_tool_${toolCalls.length}`,
            name: part.functionCall.name || "",
            arguments:
              part.functionCall.args && typeof part.functionCall.args === "object"
                ? part.functionCall.args
                : {},
          });
        }
      }
    }

    let usage: TokenUsage | undefined;
    if (responseBody.usageMetadata) {
      const meta = responseBody.usageMetadata;
      usage = {
        promptTokens: meta.promptTokenCount || 0,
        completionTokens: meta.candidatesTokenCount || 0,
        totalTokens: meta.totalTokenCount || 0,
        isEstimated: false,
      };
    }

    return {
      success: true,
      content,
      reasoning: reasoning || undefined,
      toolCalls,
      finishReason:
        toolCalls.length > 0
          ? "tool_calls"
          : mapGeminiFinishReason(candidate?.finishReason),
      usage,
    };
  },

  parseStreamEvent(event) {
    if (!event.data) return {};
    try {
      const parsed = JSON.parse(event.data);
      const candidate = parsed.candidates?.[0];
      const contentParts = candidate?.content?.parts ?? [];
      const toolCalls = contentParts.flatMap((part: any, index: number) =>
        part.functionCall
          ? [
              {
                index,
                id: `gemini_tool_${index}`,
                name: part.functionCall.name,
                arguments:
                  part.functionCall.args && typeof part.functionCall.args === "object"
                    ? part.functionCall.args
                    : {},
              },
            ]
          : [],
      );
      return {
        content:
          contentParts
            .map((part: any) => (part.thought === true ? "" : part.text || ""))
            .join("") || undefined,
        reasoning:
          contentParts
            .map((part: any) => (part.thought === true ? part.text || "" : ""))
            .join("") || undefined,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        finishReason: candidate?.finishReason
          ? toolCalls.length
            ? "tool_calls"
            : mapGeminiFinishReason(candidate.finishReason)
          : undefined,
        usage: this.parseStreamUsage?.(parsed),
      };
    } catch {
      return {};
    }
  },

  parseStreamChunk(line: string): string | null {
    // Gemini 流式使用 SSE 格式（alt=sse 模式）
    // data: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}
    if (!line.startsWith("data: ")) return "";
    const data = line.slice(6).trim();
    if (!data) return "";

    try {
      const parsed = JSON.parse(data);
      const candidate = parsed.candidates?.[0];
      if (candidate?.content?.parts) {
        let text = "";
        for (const part of candidate.content.parts) {
          if (part.text) text += part.text;
        }
        return text;
      }
      // 检查是否是结束标记（finishReason）
      if (candidate?.finishReason) {
        return null;
      }
      return "";
    } catch {
      return "";
    }
  },

  parseStreamUsage(finalData: any): TokenUsage | undefined {
    if (finalData?.usageMetadata) {
      const meta = finalData.usageMetadata;
      return {
        promptTokens: meta.promptTokenCount || 0,
        completionTokens: meta.candidatesTokenCount || 0,
        totalTokens: meta.totalTokenCount || 0,
        isEstimated: false,
      };
    }
    return undefined;
  },
};

function mapGeminiFinishReason(reason: unknown): UnifiedFinishReason {
  if (reason === "STOP") return "stop";
  if (reason === "MAX_TOKENS") return "length";
  return "unknown";
}
