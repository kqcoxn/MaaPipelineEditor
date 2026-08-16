import type { UnifiedResponse } from "@/utils/ai/providers";
import type { HarnessRunStatus, ToolExecutionResult } from "./types";

export interface CompletionEvaluation {
  complete: boolean;
  status?: HarnessRunStatus;
  reason?: string;
}

export function evaluateCompletion(
  response: UnifiedResponse,
  toolResults: ToolExecutionResult[],
): CompletionEvaluation {
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
  if (toolResults.some((result) => result.error?.code === "permission_denied")) {
    return {
      complete: true,
      status: "failed",
      reason: "Run 包含权限拒绝的工具调用",
    };
  }
  return { complete: true, status: "succeeded" };
}

