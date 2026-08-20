import type { EdgeType, NodeType } from "@/stores/flow";
import { buildLaneStructure } from "./laneStructure";
import type {
  SemanticLayoutLane,
  SemanticLayoutRelation,
  SemanticLaneRole,
} from "./types";

const NODE_GAP = 56;
const MIN_NODES_BEFORE_NATURAL_BREAK = 3;

export interface CanonicalNodeMetrics {
  inlineSize: number;
  crossSize: number;
}

export interface SemanticBlock {
  id: string;
  laneId: string;
  role: SemanticLaneRole;
  anchorNodeId?: string;
  nodeIds: string[];
  inlineSize: number;
  crossSize: number;
  nodeOffsets: Record<string, { inline: number; cross: number }>;
}

export interface SemanticBlockStructure {
  blocks: SemanticBlock[];
  ranks: Map<string, number>;
  orderedLanes: SemanticLayoutLane[];
}

export function buildSemanticBlocks(
  nodes: NodeType[],
  edges: EdgeType[],
  lanes: SemanticLayoutLane[],
  relations: SemanticLayoutRelation[],
  metrics: Map<string, CanonicalNodeMetrics>,
  maxNodesPerBlock: number,
): SemanticBlockStructure {
  const structure = buildLaneStructure(
    nodes.map((node) => node.id),
    edges,
    lanes,
    relations,
  );
  const boundaries = findNaturalBoundaries(nodes, edges, structure.ranks);
  const blocks = structure.orderedLanes.flatMap((lane) => {
    return splitLane(lane, boundaries, maxNodesPerBlock).map(
      (nodeIds, index) =>
        createBlock(
          lane,
          nodeIds,
          index,
          metrics,
        ),
    );
  });
  return {
    blocks,
    ranks: structure.ranks,
    orderedLanes: structure.orderedLanes,
  };
}

function findNaturalBoundaries(
  nodes: NodeType[],
  edges: EdgeType[],
  ranks: Map<string, number>,
): Set<string> {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, 0]));
  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return;
    if (!isForwardControlEdge(edge, ranks)) return;
    outgoing.set(edge.source, outgoing.get(edge.source)! + 1);
    incoming.set(edge.target, incoming.get(edge.target)! + 1);
  });
  return new Set(
    nodes
      .filter(
        (node) =>
          incoming.get(node.id) !== 1 || outgoing.get(node.id) !== 1,
      )
      .map((node) => node.id),
  );
}

function isForwardControlEdge(
  edge: EdgeType,
  ranks: Map<string, number>,
): boolean {
  if (edge.sourceHandle === "on_error") return false;
  if (edge.attributes?.jump_back || edge.targetHandle === "jump_back") {
    return false;
  }
  return (ranks.get(edge.target) ?? 0) > (ranks.get(edge.source) ?? 0);
}

function splitLane(
  lane: SemanticLayoutLane,
  boundaries: Set<string>,
  maxNodesPerBlock: number,
): string[][] {
  const result: string[][] = [];
  let current: string[] = [];
  lane.nodeIds.forEach((nodeId, index) => {
    current = [...current, nodeId];
    const nextNodeId = lane.nodeIds[index + 1];
    const reachedSizeLimit = current.length >= maxNodesPerBlock;
    const reachedNaturalBoundary =
      current.length >= MIN_NODES_BEFORE_NATURAL_BREAK &&
      (boundaries.has(nodeId) || Boolean(nextNodeId && boundaries.has(nextNodeId)));
    if (nextNodeId && (reachedSizeLimit || reachedNaturalBoundary)) {
      result.push(current);
      current = [];
    }
  });
  if (current.length > 0) result.push(current);
  return result;
}

function createBlock(
  lane: SemanticLayoutLane,
  nodeIds: string[],
  index: number,
  metrics: Map<string, CanonicalNodeMetrics>,
): SemanticBlock {
  let inlineOffset = 0;
  let crossSize = 0;
  const nodeOffsets: Record<string, { inline: number; cross: number }> = {};
  nodeIds.forEach((nodeId) => {
    const node = metrics.get(nodeId)!;
    nodeOffsets[nodeId] = { inline: inlineOffset, cross: 0 };
    inlineOffset += node.inlineSize + NODE_GAP;
    crossSize = Math.max(crossSize, node.crossSize);
  });
  const inlineSize = Math.max(0, inlineOffset - NODE_GAP);
  nodeIds.forEach((nodeId) => {
    const node = metrics.get(nodeId)!;
    nodeOffsets[nodeId].cross = (crossSize - node.crossSize) / 2;
  });
  return {
    id: `${lane.id}:${index + 1}`,
    laneId: lane.id,
    role: lane.role,
    anchorNodeId: lane.anchorNodeId,
    nodeIds,
    inlineSize,
    crossSize,
    nodeOffsets,
  };
}
