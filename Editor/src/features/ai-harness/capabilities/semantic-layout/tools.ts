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
import { calculateSemanticLayout, SemanticLayoutError } from "./layoutEngine";
import { buildSemanticLayoutContext } from "./semanticGraph";
import type { SemanticLayoutIntent } from "./types";

export const READ_SEMANTIC_LAYOUT_CONTEXT_TOOL_NAME =
  "read_semantic_layout_context";
export const APPLY_SEMANTIC_LAYOUT_INTENT_TOOL_NAME =
  "apply_semantic_layout_intent";

const laneSchema = {
  type: "object",
  properties: {
    id: {
      type: "string",
      minLength: 1,
      maxLength: 96,
      description: "本次意图内唯一的泳道 ID，不使用业务名称也可以",
    },
    role: {
      enum: ["primary", "branch", "jump_back", "error", "support"],
      description: "泳道在通用执行结构中的角色",
    },
    nodeIds: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: { type: "string", minLength: 1 },
      description: "泳道内节点 ID，按偏好的阅读顺序排列",
    },
    anchorNodeId: {
      type: "string",
      minLength: 1,
      description: "该泳道附着的来源节点，通常位于另一泳道",
    },
  },
  required: ["id", "role", "nodeIds"],
  additionalProperties: false,
};

const relationSchema = {
  type: "object",
  properties: {
    sourceLaneId: { type: "string", minLength: 1 },
    targetLaneId: { type: "string", minLength: 1 },
    placement: {
      enum: ["before", "after", "above", "below", "near"],
      description: "targetLane 相对 sourceLane 的位置",
    },
  },
  required: ["sourceLaneId", "targetLaneId", "placement"],
  additionalProperties: false,
};

export const semanticLayoutToolDefinitions: ToolDefinition[] = [
  {
    name: READ_SEMANTIC_LAYOUT_CONTEXT_TOOL_NAME,
    description:
      "读取当前画布的确定性语义布局上下文，包括有序候选、JumpBack、错误域、循环和节点引用",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    } satisfies AnySchemaObject,
  },
  {
    name: APPLY_SEMANTIC_LAYOUT_INTENT_TOOL_NAME,
    description:
      "提交业务无关的阅读泳道和相对关系，由本地算法生成语义块、比较二维候选并原子应用最优坐标；不得提交节点坐标",
    destructive: true,
    inputSchema: {
      type: "object",
      properties: {
        expectedStateVersion: { type: "integer", minimum: 1 },
        direction: {
          enum: ["RIGHT", "DOWN"],
          description: "主要阅读方向，通常使用 RIGHT",
        },
        lanes: {
          type: "array",
          minItems: 1,
          items: laneSchema,
        },
        relations: {
          type: "array",
          items: relationSchema,
        },
      },
      required: ["expectedStateVersion", "direction", "lanes", "relations"],
      additionalProperties: false,
    } satisfies AnySchemaObject,
  },
];

export function createSemanticLayoutToolHandlers(
  commandBus: CanvasCommandBus = canvasCommandBus,
): Record<string, ToolHandler> {
  return {
    [READ_SEMANTIC_LAYOUT_CONTEXT_TOOL_NAME]: (_argumentsValue, context) => {
      const result = commandBus.readGraphState(context);
      if (!result.ok || !result.data) return result;
      return {
        ok: true,
        stateVersion: result.stateVersion,
        data: buildSemanticLayoutContext(
          result.data as CanvasGraphState,
          result.stateVersion,
        ),
      };
    },
    [APPLY_SEMANTIC_LAYOUT_INTENT_TOOL_NAME]: async (
      argumentsValue,
      context,
    ) => {
      const graphResult = commandBus.readGraphState(context);
      if (!graphResult.ok || !graphResult.data) return graphResult;
      try {
        const layoutResult = await calculateSemanticLayout(
          graphResult.data as CanvasGraphState,
          argumentsValue as unknown as SemanticLayoutIntent,
        );
        const commitResult = commandBus.applyNodePositions(
          context,
          layoutResult.positions,
        );
        if (!commitResult.ok) return commitResult;
        return {
          ...commitResult,
          data: {
            appliedNodeCount: Object.keys(layoutResult.positions).length,
            laneCount: layoutResult.laneCount,
            autoAssignedNodeIds: layoutResult.autoAssignedNodeIds,
          },
        };
      } catch (error) {
        return layoutToolError(
          error instanceof Error ? error.message : String(error),
          graphResult.stateVersion,
          error instanceof SemanticLayoutError
            ? "invalid_arguments"
            : "non_retryable",
        );
      }
    },
  };
}

export const semanticLayoutToolHandlers = createSemanticLayoutToolHandlers();

function layoutToolError(
  message: string,
  stateVersion: number,
  code: "invalid_arguments" | "non_retryable",
): ToolExecutionResult {
  return {
    ok: false,
    stateVersion,
    error: { code, message, retryable: false },
  };
}
