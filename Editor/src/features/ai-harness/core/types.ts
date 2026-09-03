import type { AnySchemaObject } from "ajv";
import type { AIProviderConfig, TokenUsage } from "@/utils/ai/providers";

export type HarnessRunStatus =
  | "queued"
  | "running"
  | "waiting_tool"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "partial";

export type ToolErrorCode =
  | "invalid_arguments"
  | "permission_denied"
  | "state_conflict"
  | "retryable"
  | "non_retryable";

export interface RuntimePolicy {
  maxTurns: number;
  maxToolCalls: number;
  compactionThresholdTokens: number;
  maxRetriesPerToolError: number;
  serialRunsPerSession: boolean;
  autoApproveTools: boolean;
}

export type ProfileRuntimePolicy = Omit<
  RuntimePolicy,
  "compactionThresholdTokens"
>;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: AnySchemaObject;
  destructive?: boolean;
}

export interface CapabilityPack {
  id: string;
  version: string;
  description: string;
  skillIds: string[];
  toolNames: string[];
}

export interface HarnessSkill {
  id: string;
  version: string;
  name: string;
  description: string;
  instructions: string;
}

export interface BusinessProfile {
  id: string;
  version: string;
  name: string;
  description: string;
  capabilityPackId: string;
  systemPrompt: string;
  inheritSessionContext: boolean;
  maxSessionMessages: number;
  requiredToolNames: string[];
  defaultPolicy: ProfileRuntimePolicy;
}

export interface ToolExecutionContext {
  runId: string;
  sessionId: string;
  fileName: string;
  expectedStateVersion: number;
  signal: AbortSignal;
}

export interface ToolExecutionError {
  code: ToolErrorCode;
  message: string;
  retryable: boolean;
  details?: unknown;
}

export interface ToolExecutionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: ToolExecutionError;
  stateVersion: number;
  changes?: string[];
  validationErrors?: string[];
  undoable?: boolean;
}

export type ToolHandler = (
  argumentsValue: Record<string, unknown>,
  context: ToolExecutionContext,
) => ToolExecutionResult | Promise<ToolExecutionResult>;

export interface HarnessModule {
  skills?: readonly HarnessSkill[];
  tools?: readonly ToolDefinition[];
  profiles?: readonly BusinessProfile[];
  capabilityPacks?: readonly CapabilityPack[];
  toolHandlers?: Readonly<Record<string, ToolHandler>>;
}

export type FrozenModelConfig = Pick<
  AIProviderConfig,
  "type" | "apiUrl" | "model" | "temperature"
>;

export interface HarnessRun {
  id: string;
  sessionId: string;
  goal: string;
  status: HarnessRunStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  profileSnapshot: Readonly<BusinessProfile>;
  capabilitySnapshot: Readonly<CapabilityPack>;
  policySnapshot: Readonly<RuntimePolicy>;
  modelSnapshot: Readonly<FrozenModelConfig>;
  turnCount: number;
  toolCallCount: number;
  tokenUsage: TokenUsage;
  changedCanvas: boolean;
  error?: string;
  summary?: string;
}

export type RunEventType =
  | "run_started"
  | "user_message"
  | "assistant_delta"
  | "assistant_reasoning"
  | "assistant_message"
  | "tool_requested"
  | "tool_result"
  | "run_status"
  | "run_completed"
  | "run_error";

export interface RunEvent {
  id: string;
  runId: string;
  sessionId: string;
  type: RunEventType;
  timestamp: number;
  text?: string;
  toolCallId?: string;
  toolName?: string;
  argumentsSummary?: string;
  result?: ToolExecutionResult;
  status?: HarnessRunStatus;
  metadata?: Record<string, unknown>;
}

export interface HarnessSessionMessage {
  id: string;
  runId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

export interface HarnessSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  runIds: string[];
  messages: HarnessSessionMessage[];
  contextSummary?: string;
}
