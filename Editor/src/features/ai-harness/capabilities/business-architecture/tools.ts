import type { AnySchemaObject } from "ajv";
import {
  CanvasCommandBus,
  canvasCommandBus,
  type CanvasGraphState,
} from "../canvas/commandBus";
import type {
  ToolDefinition,
  ToolExecutionResult,
  ToolHandler,
} from "../../core/types";
import {
  buildBusinessArchitectureContext,
  buildBusinessArchitectureDocument,
  BusinessArchitectureError,
} from "./architectureModel";
import { useBusinessArchitectureStore } from "./store";
import type {
  BusinessArchitectureDocument,
  BusinessArchitectureIntent,
} from "./types";

export const READ_BUSINESS_ARCHITECTURE_CONTEXT_TOOL_NAME =
  "read_business_architecture_context";
export const PRESENT_BUSINESS_ARCHITECTURE_TOOL_NAME =
  "present_business_architecture";

export interface BusinessArchitectureSink {
  setDocument: (document: BusinessArchitectureDocument) => void;
}

const stageSchema = {
  type: "object",
  properties: {
    id: { type: "string", minLength: 1, maxLength: 64 },
    title: { type: "string", minLength: 1, maxLength: 48 },
    description: { type: "string", minLength: 1, maxLength: 240 },
    kind: { enum: ["main", "branch", "error", "loop", "support"] },
    nodeIds: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: { type: "string", minLength: 1 },
    },
  },
  required: ["id", "title", "description", "kind", "nodeIds"],
  additionalProperties: false,
};

export const businessArchitectureToolDefinitions: ToolDefinition[] = [
  {
    name: READ_BUSINESS_ARCHITECTURE_CONTEXT_TOOL_NAME,
    description:
      "读取当前 Pipeline 的确定性执行结构、入口、候选顺序、循环、错误路径和紧凑业务线索",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    } satisfies AnySchemaObject,
  },
  {
    name: PRESENT_BUSINESS_ARCHITECTURE_TOOL_NAME,
    description:
      "提交业务阶段分组和概述；本地将校验节点归属并从真实控制边派生阶段关系，生成只读架构视图",
    inputSchema: {
      type: "object",
      properties: {
        expectedStateVersion: { type: "integer", minimum: 1 },
        title: { type: "string", minLength: 1, maxLength: 80 },
        summary: { type: "string", minLength: 1, maxLength: 500 },
        stages: {
          type: "array",
          minItems: 1,
          maxItems: 12,
          items: stageSchema,
        },
      },
      required: ["expectedStateVersion", "title", "summary", "stages"],
      additionalProperties: false,
    } satisfies AnySchemaObject,
  },
];

const defaultSink: BusinessArchitectureSink = {
  setDocument: (document) =>
    useBusinessArchitectureStore.getState().setDocument(document),
};

export function createBusinessArchitectureToolHandlers(
  commandBus: CanvasCommandBus = canvasCommandBus,
  sink: BusinessArchitectureSink = defaultSink,
): Record<string, ToolHandler> {
  return {
    [READ_BUSINESS_ARCHITECTURE_CONTEXT_TOOL_NAME]: (_argumentsValue, context) => {
      const graphResult = commandBus.readGraphState(context);
      if (!graphResult.ok || !graphResult.data) return graphResult;
      return {
        ok: true,
        stateVersion: graphResult.stateVersion,
        data: buildBusinessArchitectureContext(
          graphResult.data as CanvasGraphState,
          graphResult.stateVersion,
        ),
      };
    },
    [PRESENT_BUSINESS_ARCHITECTURE_TOOL_NAME]: (argumentsValue, context) => {
      const graphResult = commandBus.readGraphState(context);
      if (!graphResult.ok || !graphResult.data) return graphResult;
      const expectedStateVersion = argumentsValue.expectedStateVersion;
      if (expectedStateVersion !== graphResult.stateVersion) {
        return toolError(
          `画布状态已变化，期望版本 ${expectedStateVersion}，当前版本 ${graphResult.stateVersion}`,
          graphResult.stateVersion,
          "state_conflict",
          true,
        );
      }
      try {
        const document = buildBusinessArchitectureDocument(
          graphResult.data as CanvasGraphState,
          graphResult.stateVersion,
          argumentsValue as unknown as BusinessArchitectureIntent,
          context.runId,
        );
        sink.setDocument(document);
        return {
          ok: true,
          stateVersion: graphResult.stateVersion,
          data: {
            stageCount: document.stages.length,
            transitionCount: document.transitions.length,
            coveredNodeCount: document.coverage.includedNodeCount,
            autoAssignedNodeIds: document.coverage.autoAssignedNodeIds,
          },
          undoable: false,
        };
      } catch (error) {
        return toolError(
          error instanceof Error ? error.message : String(error),
          graphResult.stateVersion,
          error instanceof BusinessArchitectureError
            ? "invalid_arguments"
            : "non_retryable",
          false,
        );
      }
    },
  };
}

function toolError(
  message: string,
  stateVersion: number,
  code: "invalid_arguments" | "state_conflict" | "non_retryable",
  retryable: boolean,
): ToolExecutionResult {
  return {
    ok: false,
    stateVersion,
    error: { code, message, retryable },
  };
}

export const businessArchitectureToolHandlers =
  createBusinessArchitectureToolHandlers();
