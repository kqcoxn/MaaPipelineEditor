import type { UnifiedResponse } from "@/utils/ai/providers";
import type { HarnessRunStatus, ToolExecutionResult } from "./types";

export interface CompletionEvaluation {
  complete: boolean;
  status?: HarnessRunStatus;
  reason?: string;
}

export interface CompletionContext {
  toolResults: ToolExecutionResult[];
  changedCanvas?: boolean;
  canvasValidation?: ToolExecutionResult;
}

export function evaluateCompletion(
  response: UnifiedResponse,
  context: CompletionContext,
): CompletionEvaluation {
  const { toolResults, changedCanvas = false, canvasValidation } = context;
  if (!response.success) {
    return { complete: true, status: "failed", reason: response.error };
  }
  if (response.toolCalls.length > 0 || response.finishReason === "tool_calls") {
    return { complete: false };
  }
  if (response.finishReason === "length") {
    return { complete: true, status: "failed", reason: "模型输出达到长度限制" };
  }
  if (!response.content.trim()) {
    return { complete: true, status: "failed", reason: "模型未返回最终文本" };
  }
  if (toolResults.length === 0) {
    return {
      complete: true,
      status: "failed",
      reason: "模型未执行任何画布工具，无法确认目标已完成",
    };
  }
  if (toolResults.some((result) => result.error?.code === "permission_denied")) {
    return {
      complete: true,
      status: "failed",
      reason: "Run 包含权限拒绝的工具调用",
    };
  }
  const lastToolResult = toolResults.at(-1);
  if (!lastToolResult?.ok) {
    return {
      complete: true,
      status: "failed",
      reason: lastToolResult?.error?.message || "最后一次工具调用失败",
    };
  }
  if (changedCanvas && !canvasValidation?.ok) {
    return {
      complete: true,
      status: "failed",
      reason:
        canvasValidation?.validationErrors?.join("；") ||
        canvasValidation?.error?.message ||
        "变更后的画布未通过最终校验",
    };
  }
  return { complete: true, status: "succeeded" };
}
