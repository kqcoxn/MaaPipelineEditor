import Ajv from "ajv";
import { AIClient } from "@/utils/ai/aiClient";
import type {
  ModelToolDefinition,
  UnifiedMessage,
  UnifiedResponse,
  UnifiedToolCall,
  TokenUsage,
} from "@/utils/ai/providers";

const envelopeSchema = {
  oneOf: [
    {
      type: "object",
      properties: {
        type: { const: "final" },
        content: { type: "string" },
      },
      required: ["type", "content"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        type: { const: "tool_calls" },
        calls: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string", minLength: 1 },
              arguments: { type: "object" },
            },
            required: ["name", "arguments"],
            additionalProperties: false,
          },
        },
      },
      required: ["type", "calls"],
      additionalProperties: false,
    },
  ],
} as const;

interface EnvelopeFinal {
  type: "final";
  content: string;
}

interface EnvelopeToolCalls {
  type: "tool_calls";
  calls: Array<{
    id?: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

type ToolEnvelope = EnvelopeFinal | EnvelopeToolCalls;

const FALLBACK_INSTRUCTION = `当前 Provider 不支持原生工具调用。你必须只返回以下 JSON 之一，禁止 Markdown、代码围栏和额外字段：
1. {"type":"final","content":"最终回复"}
2. {"type":"tool_calls","calls":[{"id":"可选ID","name":"工具名","arguments":{}}]}`;

export class HarnessModelAdapter {
  private readonly ajv = new Ajv({ allErrors: true, strict: true });
  private readonly validateEnvelope = this.ajv.compile(envelopeSchema);

  constructor(private readonly client: AIClient) {}

  async complete(
    messages: UnifiedMessage[],
    tools: ModelToolDefinition[],
    onTextDelta?: (delta: string) => void,
  ): Promise<UnifiedResponse> {
    const config = await this.client.getModelConfigSnapshot();
    const nativeResult = await this.client.complete(
      messages,
      { stream: true, tools, toolChoice: "auto" },
      onTextDelta,
    );

    const hasMalformedToolCall = nativeResult.toolCalls.some(
      (call) => !call.name.trim(),
    );
    const shouldUseEnvelopeFallback =
      hasMalformedToolCall ||
      (config.type === "custom" &&
        !nativeResult.success &&
        isUnsupportedToolError(nativeResult.error));
    if (!shouldUseEnvelopeFallback) {
      return nativeResult;
    }

    const fallbackMessages: UnifiedMessage[] = [
      { role: "system", content: buildFallbackInstruction(tools) },
      ...messages,
    ];
    const fallbackResult = await this.client.complete(fallbackMessages, {
      stream: false,
    });
    if (!fallbackResult.success) return fallbackResult;

    return this.parseEnvelope(fallbackResult.content, tools, {
      ...fallbackResult,
      usage: mergeTokenUsage(nativeResult.usage, fallbackResult.usage),
    });
  }

  parseEnvelope(
    content: string,
    tools: ModelToolDefinition[],
    baseResponse?: UnifiedResponse,
  ): UnifiedResponse {
    let envelope: unknown;
    try {
      envelope = JSON.parse(content);
    } catch {
      return invalidEnvelopeResponse("JSON Envelope 不是合法 JSON", baseResponse);
    }

    if (!this.validateEnvelope(envelope)) {
      return invalidEnvelopeResponse(
        `JSON Envelope 结构非法: ${this.ajv.errorsText(
          this.validateEnvelope.errors,
        )}`,
        baseResponse,
      );
    }

    const typedEnvelope = envelope as ToolEnvelope;
    if (typedEnvelope.type === "final") {
      return {
        success: true,
        content: typedEnvelope.content,
        toolCalls: [],
        finishReason: "stop",
        usage: baseResponse?.usage,
      };
    }

    const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
    const toolCalls: UnifiedToolCall[] = [];
    for (const [index, call] of typedEnvelope.calls.entries()) {
      const tool = toolMap.get(call.name);
      if (!tool) {
        return invalidEnvelopeResponse(`JSON Envelope 包含非法工具: ${call.name}`, baseResponse);
      }
      const validateArguments = this.ajv.compile(tool.inputSchema);
      if (!validateArguments(call.arguments)) {
        return invalidEnvelopeResponse(
          `工具 ${call.name} 参数非法: ${this.ajv.errorsText(
            validateArguments.errors,
          )}`,
          baseResponse,
        );
      }
      toolCalls.push({
        id: call.id || `fallback_tool_${index}`,
        name: call.name,
        arguments: call.arguments,
      });
    }

    return {
      success: true,
      content: "",
      toolCalls,
      finishReason: "tool_calls",
      usage: baseResponse?.usage,
    };
  }
}

function buildFallbackInstruction(tools: ModelToolDefinition[]): string {
  const toolCatalog = tools
    .map(
      (tool) =>
        `${tool.name}: ${tool.description}\n输入 Schema: ${JSON.stringify(tool.inputSchema)}`,
    )
    .join("\n\n");
  return `${FALLBACK_INSTRUCTION}\n\n可用工具定义：\n${toolCatalog}`;
}

function mergeTokenUsage(
  first?: TokenUsage,
  second?: TokenUsage,
): TokenUsage | undefined {
  if (!first) return second;
  if (!second) return first;
  return {
    promptTokens: first.promptTokens + second.promptTokens,
    completionTokens: first.completionTokens + second.completionTokens,
    totalTokens: first.totalTokens + second.totalTokens,
    isEstimated: first.isEstimated || second.isEstimated,
  };
}

function isUnsupportedToolError(error?: string): boolean {
  return Boolean(error && /HTTP (400|404|415|422)|tools?|tool_choice/i.test(error));
}

function invalidEnvelopeResponse(
  error: string,
  baseResponse?: UnifiedResponse,
): UnifiedResponse {
  return {
    success: false,
    content: "",
    error,
    toolCalls: [],
    finishReason: "error",
    usage: baseResponse?.usage,
  };
}
