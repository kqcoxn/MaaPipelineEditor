import type { EdgeType, NodeType } from "@/stores/flow";
import {
  layoutAnchoredLaneClusters,
  type BranchSideBias,
} from "./anchoredLaneLayout";
import { buildLaneAttachments } from "./laneAttachments";
import { layoutNodesInLanes } from "./laneLayout";
import {
  scoreLayoutCandidate,
  type LayoutScoringCandidate,
} from "./layoutScoring";
import {
  buildSemanticBlocks,
  type CanonicalNodeMetrics,
} from "./semanticBlocks";
import type {
  SemanticLayoutDirection,
  SemanticLayoutLane,
  SemanticLayoutRelation,
} from "./types";

const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 100;
const BLOCK_SIZE_CANDIDATES = [4, 5, 6, 7, 8, 10];
const MAX_UNWRAPPED_LANE_NODES = Math.max(...BLOCK_SIZE_CANDIDATES);
const ROOT_SHELF_FACTORS = [1, 1.4, 2];
const BRANCH_SIDE_BIASES: BranchSideBias[] = ["above", "below"];

export function layoutNodesInSemanticBlocks(
  nodes: NodeType[],
  edges: EdgeType[],
  lanes: SemanticLayoutLane[],
  relations: SemanticLayoutRelation[],
  direction: SemanticLayoutDirection,
): Record<string, { x: number; y: number }> {
  const metrics = buildCanonicalMetrics(nodes, direction);
  const candidates = BLOCK_SIZE_CANDIDATES.flatMap((maxNodesPerRow) =>
    createAnchoredCandidates(
      nodes,
      edges,
      lanes,
      relations,
      metrics,
      maxNodesPerRow,
      direction,
    ),
  );
  if (nodes.length <= MAX_UNWRAPPED_LANE_NODES) {
    candidates.push(
      createLegacyCandidate(
        nodes,
        edges,
        lanes,
        relations,
        metrics,
        direction,
      ),
    );
  }
  return candidates
    .map((candidate) => ({
      candidate,
      score: scoreLayoutCandidate(candidate, edges, direction, metrics),
    }))
    .reduce((best, current) =>
      current.score < best.score ? current : best,
    ).candidate.positions;
}

function createAnchoredCandidates(
  nodes: NodeType[],
  edges: EdgeType[],
  lanes: SemanticLayoutLane[],
  relations: SemanticLayoutRelation[],
  metrics: Map<string, CanonicalNodeMetrics>,
  maxNodesPerRow: number,
  direction: SemanticLayoutDirection,
): LayoutScoringCandidate[] {
  const { blocks, ranks, orderedLanes } = buildSemanticBlocks(
    nodes,
    edges,
    lanes,
    relations,
    metrics,
    maxNodesPerRow,
  );
  const attachments = buildLaneAttachments(orderedLanes, edges, relations);
  const proximityPairs = buildProximityPairs(
    orderedLanes,
    relations,
    attachments.attachments,
  );
  return ROOT_SHELF_FACTORS.flatMap((rootShelfFactor) =>
    BRANCH_SIDE_BIASES.map((branchSideBias) => {
      const canonicalPositions = layoutAnchoredLaneClusters(
        blocks,
        orderedLanes,
        attachments,
        metrics,
        maxNodesPerRow,
        rootShelfFactor,
        branchSideBias,
      );
      return {
        positions:
          direction === "RIGHT"
            ? canonicalPositions
            : transposePositions(canonicalPositions),
        ranks,
        proximityPairs,
      };
    }),
  );
}

function createLegacyCandidate(
  nodes: NodeType[],
  edges: EdgeType[],
  lanes: SemanticLayoutLane[],
  relations: SemanticLayoutRelation[],
  metrics: Map<string, CanonicalNodeMetrics>,
  direction: SemanticLayoutDirection,
): LayoutScoringCandidate {
  const structure = buildSemanticBlocks(
    nodes,
    edges,
    lanes,
    relations,
    metrics,
    Number.MAX_SAFE_INTEGER,
  );
  const attachments = buildLaneAttachments(
    structure.orderedLanes,
    edges,
    relations,
  );
  return {
    positions: layoutNodesInLanes(nodes, edges, lanes, relations, direction),
    ranks: structure.ranks,
    proximityPairs: buildProximityPairs(
      structure.orderedLanes,
      relations,
      attachments.attachments,
    ),
  };
}

function buildCanonicalMetrics(
  nodes: NodeType[],
  direction: SemanticLayoutDirection,
): Map<string, CanonicalNodeMetrics> {
  return new Map(
    nodes.map((node) => {
      const width = node.measured?.width ?? DEFAULT_NODE_WIDTH;
      const height = node.measured?.height ?? DEFAULT_NODE_HEIGHT;
      return [
        node.id,
        direction === "RIGHT"
          ? { inlineSize: width, crossSize: height }
          : { inlineSize: height, crossSize: width },
      ];
    }),
  );
}

function buildProximityPairs(
  lanes: SemanticLayoutLane[],
  relations: SemanticLayoutRelation[],
  attachments: Array<{ anchorNodeId: string; laneId: string }>,
): Array<{ source: string; target: string }> {
  const laneMap = new Map(lanes.map((lane) => [lane.id, lane]));
  const attachmentPairs = attachments
    .map((attachment) => {
      const target = laneMap.get(attachment.laneId)?.nodeIds[0];
      return target
        ? { source: attachment.anchorNodeId, target }
        : undefined;
    })
    .filter(
      (pair): pair is { source: string; target: string } => pair !== undefined,
    );
  const relationPairs = relations
    .filter((relation) => relation.placement === "near")
    .map((relation) => {
      const source = laneMap.get(relation.sourceLaneId)?.nodeIds[0];
      const target = laneMap.get(relation.targetLaneId)?.nodeIds[0];
      return source && target ? { source, target } : undefined;
    })
    .filter(
      (pair): pair is { source: string; target: string } => pair !== undefined,
    );
  const uniquePairs = new Map(
    [...attachmentPairs, ...relationPairs].map((pair) => [
      `${pair.source}\u0000${pair.target}`,
      pair,
    ]),
  );
  return [...uniquePairs.values()];
}

function transposePositions(
  positions: Record<string, { x: number; y: number }>,
): Record<string, { x: number; y: number }> {
  return Object.fromEntries(
    Object.entries(positions).map(([nodeId, position]) => [
      nodeId,
      { x: position.y, y: position.x },
    ]),
  );
}
