import type { AnySchemaObject } from "ajv";
import type { UnifiedToolCall } from "@/utils/ai/providers";
import { canvasCommandBus, type CanvasMutation } from "./canvasCommandBus";
import { HarnessRegistry, canvasChatProfile } from "./registry";
import type {
  CapabilityPack,
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
} from "./types";

const positionSchema = {
  type: "object",
  properties: {
    x: { type: "number" },
    y: { type: "number" },
  },
  required: ["x", "y"],
  additionalProperties: false,
};

const attributesSchema = {
  type: "object",
  properties: {
    jump_back: { type: "boolean" },
    anchor: { type: "boolean" },
  },
  additionalProperties: false,
};

const mutationSchemas: Record<CanvasMutation["type"], AnySchemaObject> = {
  create_node: {
    type: "object",
    properties: {
      type: { const: "create_node" },
      nodeId: { type: "string", minLength: 1, maxLength: 128 },
      name: { type: "string", minLength: 1 },
      nodeType: {
        enum: ["pipeline", "external", "anchor", "sticker", "group"],
      },
      pipeline: { type: "object" },
      data: { type: "object" },
      position: positionSchema,
    },
    required: ["type", "name"],
    additionalProperties: false,
  },
  update_node: {
    type: "object",
    properties: {
      type: { const: "update_node" },
      nodeId: { type: "string", minLength: 1 },
      name: { type: "string", minLength: 1 },
      pipeline: { type: "object" },
      data: { type: "object" },
      position: positionSchema,
    },
    required: ["type", "nodeId"],
    additionalProperties: false,
  },
  delete_node: {
    type: "object",
    properties: {
      type: { const: "delete_node" },
      nodeId: { type: "string", minLength: 1 },
    },
    required: ["type", "nodeId"],
    additionalProperties: false,
  },
  create_connection: {
    type: "object",
    properties: {
      type: { const: "create_connection" },
      sourceId: { type: "string", minLength: 1 },
      targetId: { type: "string", minLength: 1 },
      sourceHandle: { enum: ["next", "on_error"] },
      targetHandle: { enum: ["target", "jump_back"] },
      attributes: attributesSchema,
    },
    required: ["type", "sourceId", "targetId", "sourceHandle"],
    additionalProperties: false,
  },
  update_connection: {
    type: "object",
    properties: {
      type: { const: "update_connection" },
      connectionId: { type: "string", minLength: 1 },
      sourceId: { type: "string", minLength: 1 },
      targetId: { type: "string", minLength: 1 },
      sourceHandle: { enum: ["next", "on_error"] },
      targetHandle: { enum: ["target", "jump_back"] },
      attributes: attributesSchema,
    },
    required: ["type", "connectionId"],
    additionalProperties: false,
  },
  delete_connection: {
    type: "object",
    properties: {
      type: { const: "delete_connection" },
      connectionId: { type: "string", minLength: 1 },
    },
    required: ["type", "connectionId"],
    additionalProperties: false,
  },
};

const stateVersionProperty = {
  expectedStateVersion: { type: "integer", minimum: 1 },
};

function writeSchema(
  properties: Record<string, unknown>,
  required: string[],
): AnySchemaObject {
  return {
    type: "object",
    properties: { ...properties, ...stateVersionProperty },
    required: [...required, "expectedStateVersion"],
    additionalProperties: false,
  };
}

export const canvasToolDefinitions: ToolDefinition[] = [
  {
    name: "read_canvas_summary",
    description: "读取当前文件名、画布状态版本、节点和连接摘要",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "read_node",
    description: "按节点 ID 读取节点完整 Pipeline JSON",
    inputSchema: {
      type: "object",
      properties: { nodeId: { type: "string", minLength: 1 } },
      required: ["nodeId"],
      additionalProperties: false,
    },
  },
  {
    name: "read_selection",
    description: "读取当前选中节点和目标节点",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "validate_canvas",
    description: "校验当前画布并返回结构化错误",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "create_node",
    description: "在当前文件创建节点",
    destructive: true,
    inputSchema: writeSchema(
      {
        name: { type: "string", minLength: 1 },
        nodeId: { type: "string", minLength: 1, maxLength: 128 },
        nodeType: {
          enum: ["pipeline", "external", "anchor", "sticker", "group"],
        },
        pipeline: { type: "object" },
        data: { type: "object" },
        position: positionSchema,
      },
      ["name"],
    ),
  },
  {
    name: "update_node",
    description: "修改当前文件中的节点",
    destructive: true,
    inputSchema: writeSchema(
      {
        nodeId: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        pipeline: { type: "object" },
        data: { type: "object" },
        position: positionSchema,
      },
      ["nodeId"],
    ),
  },
  {
    name: "delete_node",
    description: "删除节点及其连接",
    destructive: true,
    inputSchema: writeSchema(
      { nodeId: { type: "string", minLength: 1 } },
      ["nodeId"],
    ),
  },
  {
    name: "create_connection",
    description: "创建 next 或 on_error 连接",
    destructive: true,
    inputSchema: writeSchema(
      {
        sourceId: { type: "string", minLength: 1 },
        targetId: { type: "string", minLength: 1 },
        sourceHandle: { enum: ["next", "on_error"] },
        targetHandle: { enum: ["target", "jump_back"] },
        attributes: attributesSchema,
      },
      ["sourceId", "targetId", "sourceHandle"],
    ),
  },
  {
    name: "update_connection",
    description: "修改已有连接",
    destructive: true,
    inputSchema: writeSchema(
      {
        connectionId: { type: "string", minLength: 1 },
        sourceId: { type: "string", minLength: 1 },
        targetId: { type: "string", minLength: 1 },
        sourceHandle: { enum: ["next", "on_error"] },
        targetHandle: { enum: ["target", "jump_back"] },
        attributes: attributesSchema,
      },
      ["connectionId"],
    ),
  },
  {
    name: "delete_connection",
    description: "删除已有连接",
    destructive: true,
    inputSchema: writeSchema(
      { connectionId: { type: "string", minLength: 1 } },
      ["connectionId"],
    ),
  },
  {
    name: "apply_canvas_changes",
    description: "原子应用一组节点和连接变更，任一失败则全部不提交",
    destructive: true,
    inputSchema: writeSchema(
      {
        changes: {
          type: "array",
          minItems: 1,
          items: { oneOf: Object.values(mutationSchemas) },
        },
      },
      ["changes"],
    ),
  },
];

export const canvasCapabilityPack: CapabilityPack = {
  id: "canvas",
  version: "1.0.0",
  description: "当前文件画布、节点和连接的完整受控操作",
  toolNames: canvasToolDefinitions.map((tool) => tool.name),
};

type ToolHandler = (
  argumentsValue: Record<string, unknown>,
  context: ToolExecutionContext,
) => ToolExecutionResult | Promise<ToolExecutionResult>;

export const canvasToolHandlers: Record<string, ToolHandler> = {
  read_canvas_summary: () => canvasCommandBus.readSummary(),
  read_node: (argumentsValue) =>
    canvasCommandBus.readNode(argumentsValue.nodeId as string),
  read_selection: () => canvasCommandBus.readSelection(),
  validate_canvas: () => canvasCommandBus.validateCanvas(),
  create_node: (argumentsValue, context) =>
    canvasCommandBus.apply(context, [
      { type: "create_node", ...withoutVersion(argumentsValue) } as CanvasMutation,
    ]),
  update_node: (argumentsValue, context) =>
    canvasCommandBus.apply(context, [
      { type: "update_node", ...withoutVersion(argumentsValue) } as CanvasMutation,
    ]),
  delete_node: (argumentsValue, context) =>
    canvasCommandBus.apply(context, [
      { type: "delete_node", ...withoutVersion(argumentsValue) } as CanvasMutation,
    ]),
  create_connection: (argumentsValue, context) =>
    canvasCommandBus.apply(context, [
      {
        type: "create_connection",
        ...withoutVersion(argumentsValue),
      } as CanvasMutation,
    ]),
  update_connection: (argumentsValue, context) =>
    canvasCommandBus.apply(context, [
      {
        type: "update_connection",
        ...withoutVersion(argumentsValue),
      } as CanvasMutation,
    ]),
  delete_connection: (argumentsValue, context) =>
    canvasCommandBus.apply(context, [
      {
        type: "delete_connection",
        ...withoutVersion(argumentsValue),
      } as CanvasMutation,
    ]),
  apply_canvas_changes: (argumentsValue, context) =>
    canvasCommandBus.apply(context, argumentsValue.changes as CanvasMutation[]),
};

function withoutVersion(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const { expectedStateVersion: _expectedStateVersion, ...rest } = value;
  return rest;
}

export function createCanvasHarnessRegistry(): HarnessRegistry {
  const registry = new HarnessRegistry();
  canvasToolDefinitions.forEach((tool) => registry.registerTool(tool));
  registry.registerCapabilityPack(canvasCapabilityPack);
  registry.registerProfile(canvasChatProfile);
  return registry;
}

export function summarizeToolArguments(call: UnifiedToolCall): string {
  const value = JSON.stringify(call.arguments);
  return value.length <= 240 ? value : `${value.slice(0, 237)}...`;
}
