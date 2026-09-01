import {
  type EdgeType,
  type NodeType,
  type PipelineNodeType,
} from "@/stores/flow";
import { NodeTypeEnum } from "../../../flow/nodes/constants";
import {
  NODE_TYPE_CONFIG,
  type NodeGroup,
  type NodeListItemInfo,
  type NodeListRow,
} from "./types";

export interface NodeListStatistics {
  total: number;
  byType: Record<NodeTypeEnum, number>;
}

export function buildNodeListData(
  nodes: NodeType[],
  edges: EdgeType[],
): NodeListItemInfo[] {
  const edgeCounts = new Map<string, { in: number; out: number }>();
  for (const node of nodes) {
    edgeCounts.set(node.id, { in: 0, out: 0 });
  }
  for (const edge of edges) {
    const targetCount = edgeCounts.get(edge.target);
    if (targetCount) targetCount.in += 1;
    const sourceCount = edgeCounts.get(edge.source);
    if (sourceCount) sourceCount.out += 1;
  }

  return nodes.map((node) => {
    const counts = edgeCounts.get(node.id) ?? { in: 0, out: 0 };
    const item: NodeListItemInfo = {
      id: node.id,
      label: node.data.label,
      nodeType: node.type,
      inEdgeCount: counts.in,
      outEdgeCount: counts.out,
    };

    if (node.type !== NodeTypeEnum.Pipeline) return item;

    const pipelineNode = node as PipelineNodeType;
    item.recognitionType = pipelineNode.data.recognition?.type ?? "DirectHit";
    item.actionType = pipelineNode.data.action?.type ?? "DoNothing";
    item.recognitionParam = pipelineNode.data.recognition?.param ?? {};
    item.actionParam = pipelineNode.data.action?.param ?? {};
    item.others = pipelineNode.data.others ?? {};

    const template = item.recognitionParam.template;
    if (Array.isArray(template)) {
      item.templatePaths = template.filter(
        (path): path is string => typeof path === "string" && path.trim().length > 0,
      );
    }
    return item;
  });
}

export function filterNodeListData(
  nodes: NodeListItemInfo[],
  keyword: string,
  selectedType: NodeTypeEnum | "all",
): NodeListItemInfo[] {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase();
  return nodes.filter((node) => {
    if (selectedType !== "all" && node.nodeType !== selectedType) return false;
    if (!normalizedKeyword) return true;
    return [node.label, node.recognitionType, node.actionType].some((value) =>
      value?.toLocaleLowerCase().includes(normalizedKeyword),
    );
  });
}

export function groupNodeListData(nodes: NodeListItemInfo[]): NodeGroup[] {
  const grouped = new Map<NodeTypeEnum, NodeListItemInfo[]>([
    [NodeTypeEnum.Pipeline, []],
    [NodeTypeEnum.External, []],
    [NodeTypeEnum.Anchor, []],
    [NodeTypeEnum.Sticker, []],
    [NodeTypeEnum.Group, []],
  ]);

  for (const node of nodes) {
    grouped.get(node.nodeType)?.push(node);
  }

  return Array.from(grouped.entries()).flatMap(([type, groupNodes]) =>
    groupNodes.length === 0
      ? []
      : [
          {
            type,
            ...NODE_TYPE_CONFIG[type],
            nodes: groupNodes,
            count: groupNodes.length,
          },
        ],
  );
}

export function buildNodeListRows(
  groups: NodeGroup[],
  expandedGroups: ReadonlySet<NodeTypeEnum>,
): NodeListRow[] {
  return groups.flatMap((group) => [
    { key: `group:${group.type}`, kind: "group" as const, group },
    ...(expandedGroups.has(group.type)
      ? group.nodes.map((node) => ({
          key: `node:${node.id}`,
          kind: "node" as const,
          node,
        }))
      : []),
  ]);
}

export function calculateNodeListStatistics(
  nodes: NodeListItemInfo[],
): NodeListStatistics {
  const byType: Record<NodeTypeEnum, number> = {
    [NodeTypeEnum.Pipeline]: 0,
    [NodeTypeEnum.External]: 0,
    [NodeTypeEnum.Anchor]: 0,
    [NodeTypeEnum.Sticker]: 0,
    [NodeTypeEnum.Group]: 0,
  };
  for (const node of nodes) byType[node.nodeType] += 1;
  return { total: nodes.length, byType };
}
