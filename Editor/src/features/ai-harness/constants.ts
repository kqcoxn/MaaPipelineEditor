import type { RuntimePolicy } from "./types";

export const MAX_EVENTS_PER_RUN = 300;
export const MAX_RUNS_PER_SESSION = 20;
export const DEFAULT_SESSION_TITLE = "新会话";

export const CANVAS_CHAT_POLICY: RuntimePolicy = {
  maxTurns: 12,
  maxToolCalls: 24,
  timeoutMs: 120_000,
  maxTokens: 32_000,
  maxRetriesPerToolError: 2,
  serialRunsPerSession: true,
  autoApproveTools: true,
};

