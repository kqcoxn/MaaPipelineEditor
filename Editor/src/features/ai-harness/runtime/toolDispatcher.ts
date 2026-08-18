import Ajv from "ajv";
import type { UnifiedToolCall } from "@/utils/ai/providers";
import type { HarnessRegistry } from "../core/registry";
import type {
  CapabilityPack,
  HarnessRun,
  ToolExecutionContext,
  ToolHandler,
  ToolExecutionResult,
} from "../core/types";

export interface ToolDispatchBudget {
  toolCallCount: number;
  fingerprints: Set<string>;
}

export class ToolDispatcher {
  private readonly ajv = new Ajv({ allErrors: true, strict: true });

  constructor(
    private readonly registry: HarnessRegistry,
    private readonly handlers: Readonly<Record<string, ToolHandler>>,
  ) {}

  async dispatch(
    call: UnifiedToolCall,
    run: HarnessRun,
    capabilityPack: Readonly<CapabilityPack>,
    context: ToolExecutionContext,
    budget: ToolDispatchBudget,
    retryAttempt = 0,
  ): Promise<ToolExecutionResult> {
    const currentVersion = context.expectedStateVersion;
    if (budget.toolCallCount >= run.policySnapshot.maxToolCalls) {
      return rejected("non_retryable", "已达到工具调用预算", currentVersion);
    }
    budget.toolCallCount += 1;

    if (!call.name.trim()) {
      return rejected(
        "invalid_arguments",
        "模型返回的工具名称不能为空",
        currentVersion,
      );
    }
    const definition = this.registry.getTool(call.name);
    if (!definition || !capabilityPack.toolNames.includes(call.name)) {
      return rejected(
        "permission_denied",
        `工具未注册或当前不可用: ${call.name}`,
        currentVersion,
      );
    }
    const handler = this.handlers[call.name];
    if (!handler) {
      return rejected("permission_denied", `工具没有受控执行器: ${call.name}`, currentVersion);
    }

    const validate = this.ajv.compile(definition.inputSchema);
    if (!validate(call.arguments)) {
      return rejected(
        "invalid_arguments",
        `工具参数校验失败: ${this.ajv.errorsText(validate.errors)}`,
        currentVersion,
      );
    }
    const fingerprint = `${call.name}:${stableStringify(call.arguments)}`;
    if (retryAttempt === 0 && budget.fingerprints.has(fingerprint)) {
      return rejected("non_retryable", "拒绝重复的工具和参数调用", currentVersion);
    }
    budget.fingerprints.add(fingerprint);

    return handler(call.arguments, {
      ...context,
      expectedStateVersion:
        typeof call.arguments.expectedStateVersion === "number"
          ? call.arguments.expectedStateVersion
          : context.expectedStateVersion,
    });
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function rejected(
  code: "invalid_arguments" | "permission_denied" | "non_retryable",
  message: string,
  stateVersion: number,
): ToolExecutionResult {
  return {
    ok: false,
    stateVersion,
    error: { code, message, retryable: false },
  };
}
