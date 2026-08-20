import type { EdgeType, NodeType } from "@/stores/flow";
import { buildLaneStructure } from "./laneStructure";
import type {
  SemanticLayoutDirection,
  SemanticLayoutLane,
  SemanticLayoutRelation,
} from "./types";

const NODE_GAP = 56;
const STAGE_GAP = 96;
const LANE_GAP = 120;
const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 100;

interface NodeMetrics {
  width: number;
  height: number;
}

export function layoutNodesInLanes(
  nodes: NodeType[],
  edges: EdgeType[],
  lanes: SemanticLayoutLane[],
  relations: SemanticLayoutRelation[],
  direction: SemanticLayoutDirection,
): Record<string, { x: number; y: number }> {
  const { ranks, orderedLanes, laneNodeOrder } = buildLaneStructure(
    nodes.map((node) => node.id),
    edges,
    lanes,
    relations,
  );
  const metrics = new Map(
    nodes.map((node) => [
      node.id,
      {
        width: node.measured?.width ?? DEFAULT_NODE_WIDTH,
        height: node.measured?.height ?? DEFAULT_NODE_HEIGHT,
      },
    ]),
  );
  return direction === "RIGHT"
    ? layoutHorizontally(orderedLanes, ranks, metrics, laneNodeOrder)
    : layoutVertically(orderedLanes, ranks, metrics, laneNodeOrder);
}

function groupLaneNodesByRank(
  lane: SemanticLayoutLane,
  ranks: Map<string, number>,
  laneNodeOrder: Map<string, number>,
): Map<number, string[]> {
  const groups = new Map<number, string[]>();
  lane.nodeIds.forEach((nodeId) => {
    const rank = ranks.get(nodeId) ?? 0;
    groups.set(rank, [...(groups.get(rank) ?? []), nodeId]);
  });
  groups.forEach((nodeIds) =>
    nodeIds.sort(
      (left, right) =>
        laneNodeOrder.get(left)! - laneNodeOrder.get(right)!,
    ),
  );
  return groups;
}

function layoutHorizontally(
  lanes: SemanticLayoutLane[],
  ranks: Map<string, number>,
  metrics: Map<string, NodeMetrics>,
  laneNodeOrder: Map<string, number>,
): Record<string, { x: number; y: number }> {
  const maxRank = Math.max(0, ...ranks.values());
  const stageWidths = Array.from({ length: maxRank + 1 }, () => 0);
  ranks.forEach((rank, nodeId) => {
    stageWidths[rank] = Math.max(
      stageWidths[rank],
      metrics.get(nodeId)!.width,
    );
  });
  const stageOffsets = buildOffsets(stageWidths, STAGE_GAP);
  const positions: Record<string, { x: number; y: number }> = {};
  let laneOffset = 0;
  lanes.forEach((lane) => {
    const groups = groupLaneNodesByRank(lane, ranks, laneNodeOrder);
    const laneHeight = Math.max(
      ...[...groups.values()].map((nodeIds) =>
        totalSize(
          nodeIds.map((id) => metrics.get(id)!.height),
          NODE_GAP,
        ),
      ),
    );
    groups.forEach((nodeIds, rank) => {
      const groupHeight = totalSize(
        nodeIds.map((id) => metrics.get(id)!.height),
        NODE_GAP,
      );
      let y = laneOffset + (laneHeight - groupHeight) / 2;
      nodeIds.forEach((nodeId) => {
        const node = metrics.get(nodeId)!;
        positions[nodeId] = {
          x: stageOffsets[rank] + (stageWidths[rank] - node.width) / 2,
          y,
        };
        y += node.height + NODE_GAP;
      });
    });
    laneOffset += laneHeight + LANE_GAP;
  });
  return positions;
}

function layoutVertically(
  lanes: SemanticLayoutLane[],
  ranks: Map<string, number>,
  metrics: Map<string, NodeMetrics>,
  laneNodeOrder: Map<string, number>,
): Record<string, { x: number; y: number }> {
  const maxRank = Math.max(0, ...ranks.values());
  const stageHeights = Array.from({ length: maxRank + 1 }, () => 0);
  ranks.forEach((rank, nodeId) => {
    stageHeights[rank] = Math.max(
      stageHeights[rank],
      metrics.get(nodeId)!.height,
    );
  });
  const stageOffsets = buildOffsets(stageHeights, STAGE_GAP);
  const positions: Record<string, { x: number; y: number }> = {};
  let laneOffset = 0;
  lanes.forEach((lane) => {
    const groups = groupLaneNodesByRank(lane, ranks, laneNodeOrder);
    const laneWidth = Math.max(
      ...[...groups.values()].map((nodeIds) =>
        totalSize(
          nodeIds.map((id) => metrics.get(id)!.width),
          NODE_GAP,
        ),
      ),
    );
    groups.forEach((nodeIds, rank) => {
      const groupWidth = totalSize(
        nodeIds.map((id) => metrics.get(id)!.width),
        NODE_GAP,
      );
      let x = laneOffset + (laneWidth - groupWidth) / 2;
      nodeIds.forEach((nodeId) => {
        const node = metrics.get(nodeId)!;
        positions[nodeId] = {
          x,
          y: stageOffsets[rank] + (stageHeights[rank] - node.height) / 2,
        };
        x += node.width + NODE_GAP;
      });
    });
    laneOffset += laneWidth + LANE_GAP;
  });
  return positions;
}

function buildOffsets(sizes: number[], gap: number): number[] {
  let offset = 0;
  return sizes.map((size) => {
    const current = offset;
    offset += size + gap;
    return current;
  });
}

function totalSize(sizes: number[], gap: number): number {
  return (
    sizes.reduce((sum, size) => sum + size, 0) +
    Math.max(0, sizes.length - 1) * gap
  );
}
