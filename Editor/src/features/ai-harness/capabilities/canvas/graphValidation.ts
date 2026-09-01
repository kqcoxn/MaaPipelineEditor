import {
  NodeTypeEnum,
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "@/components/flow/nodes";
import {
  getConnectionKey,
  type EdgeType,
  type NodeType,
} from "@/stores/flow";
import { validateAndRepairNode } from "@/utils/node/nodeJsonValidator";
import { validatePipelineDefinition } from "./pipelineValidation";

export function validateCanvasGraph(
  nodes: NodeType[],
  edges: EdgeType[],
): string[] {
  const errors: string[] = [];
  const nodeIds = new Set<string>();
  const uniqueLabels = new Map<string, NodeType>();
  const nodeNames = new Set(nodes.map((node) => node.data.label));
  const anchorNames = collectAnchorNames(nodes);
  for (const node of nodes) {
    if (nodeIds.has(node.id)) errors.push(`节点 ID 重复: ${node.id}`);
    nodeIds.add(node.id);
    if (!node.data.label?.trim()) errors.push(`节点名称不能为空: ${node.id}`);
    const existing = uniqueLabels.get(node.data.label);
    const allowsReplica =
      existing &&
      existing.type === node.type &&
      [NodeTypeEnum.External, NodeTypeEnum.Anchor].includes(node.type);
    if (existing && !allowsReplica) errors.push(`节点名称重复: ${node.data.label}`);
    uniqueLabels.set(node.data.label, node);
    const validation = validateAndRepairNode(structuredClone(node));
    if (!validation.valid) errors.push(validation.error || `节点非法: ${node.id}`);
    if (validation.repaired) {
      errors.push(validation.error || `节点数据结构不完整: ${node.id}`);
    }
    if (node.type === NodeTypeEnum.Pipeline) {
      validatePipelineDefinition(
        {
          recognition: node.data.recognition,
          action: node.data.action,
          ...node.data.others,
          ...node.data.extras,
        },
        { nodeNames, anchorNames },
      ).forEach((error) => errors.push(`${node.data.label}: ${error}`));
    }
  }

  const edgeIds = new Set<string>();
  const connectionKeys = new Set<string>();
  for (const edge of edges) {
    if (edgeIds.has(edge.id)) errors.push(`连接 ID 重复: ${edge.id}`);
    edgeIds.add(edge.id);
    const source = nodes.find((node) => node.id === edge.source);
    const target = nodes.find((node) => node.id === edge.target);
    if (!source) errors.push(`连接源节点不存在: ${edge.id}`);
    if (!target) errors.push(`连接目标节点不存在: ${edge.id}`);
    if (source && source.type !== NodeTypeEnum.Pipeline) {
      errors.push(`连接源节点没有输出句柄: ${source.id}`);
    }
    if (target && [NodeTypeEnum.Sticker, NodeTypeEnum.Group].includes(target.type)) {
      errors.push(`连接目标节点没有输入句柄: ${target.id}`);
    }
    if (!Object.values(SourceHandleTypeEnum).includes(edge.sourceHandle)) {
      errors.push(`非法源句柄: ${edge.sourceHandle}`);
    }
    if (!Object.values(TargetHandleTypeEnum).includes(edge.targetHandle)) {
      errors.push(`非法目标句柄: ${edge.targetHandle}`);
    }
    const key = getConnectionKey(edge);
    if (connectionKeys.has(key)) errors.push(`重复连接: ${key}`);
    connectionKeys.add(key);
    const oppositeHandle =
      edge.sourceHandle === SourceHandleTypeEnum.Next
        ? SourceHandleTypeEnum.Error
        : SourceHandleTypeEnum.Next;
    const opposite = `${edge.source}|${oppositeHandle}|${edge.target}|${edge.targetHandle}`;
    if (connectionKeys.has(opposite)) {
      errors.push(
        `同一节点不能同时通过 next 和 on_error 指向目标: ${edge.source} -> ${edge.target}`,
      );
    }
  }
  return [...new Set(errors)];
}

function collectAnchorNames(nodes: NodeType[]): Set<string> {
  const anchors = new Set<string>();
  nodes.forEach((node) => {
    if (node.type !== NodeTypeEnum.Pipeline) return;
    const value = node.data.others.anchor;
    if (typeof value === "string") anchors.add(value);
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === "string") anchors.add(item);
      });
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.keys(value).forEach((name) => anchors.add(name));
    }
  });
  return anchors;
}

export function normalizeCanvasEdgeLabels(edges: EdgeType[]): EdgeType[] {
  const counters = new Map<string, number>();
  return edges.map((edge) => {
    const key = `${edge.source}|${edge.sourceHandle}`;
    const label = (counters.get(key) ?? 0) + 1;
    counters.set(key, label);
    return { ...edge, label };
  });
}
