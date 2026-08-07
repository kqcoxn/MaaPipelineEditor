/** 调试 AI 业务已移除，保留兼容类型以避免旧状态模块破坏构建。 */
export type DebugAiSummaryFocus = "full" | "node";

export function buildDebugAiSummaryPrompt(..._args: unknown[]): never {
  throw new Error("调试 AI 总结功能已移除");
}

export function parseDebugAiSummaryResponse(..._args: unknown[]): never {
  throw new Error("调试 AI 总结功能已移除");
}
