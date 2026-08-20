import type { CanonicalNodeMetrics, SemanticBlock } from "./semanticBlocks";
import type {
  LaneAttachmentSide,
  LaneAttachmentStructure,
} from "./laneAttachments";
import type { SemanticLayoutLane } from "./types";

const BLOCK_INLINE_GAP = 72;
const LANE_ROW_GAP = 160;
const ATTACH_INLINE_GAP = 56;
const ATTACH_CROSS_GAP = 140;
const ROOT_CLUSTER_GAP = 180;
const TARGET_ASPECT_RATIO = 1.8;

export type BranchSideBias = "above" | "below";

interface CanonicalPosition {
  inline: number;
  cross: number;
}

interface CanonicalBounds {
  minInline: number;
  minCross: number;
  maxInline: number;
  maxCross: number;
}

interface PositionedCluster {
  positions: Record<string, CanonicalPosition>;
  bounds: CanonicalBounds;
  rootFirstNodeId: string;
}

interface LaneRow {
  blocks: SemanticBlock[];
  nodeCount: number;
}

export function layoutAnchoredLaneClusters(
  blocks: SemanticBlock[],
  lanes: SemanticLayoutLane[],
  attachmentStructure: LaneAttachmentStructure,
  metrics: Map<string, CanonicalNodeMetrics>,
  maxNodesPerRow: number,
  rootShelfFactor: number,
  branchSideBias: BranchSideBias,
): Record<string, { x: number; y: number }> {
  const blocksByLaneId = new Map(
    lanes.map((lane) => [
      lane.id,
      blocks.filter((block) => block.laneId === lane.id),
    ]),
  );
  const laneMap = new Map(lanes.map((lane) => [lane.id, lane]));
  const clusterCache = new Map<string, PositionedCluster>();

  const buildCluster = (laneId: string): PositionedCluster => {
    const cached = clusterCache.get(laneId);
    if (cached) return cached;
    const lane = laneMap.get(laneId)!;
    const laneCluster = layoutLaneBlocks(
      blocksByLaneId.get(laneId) ?? [],
      maxNodesPerRow,
    );
    const positions = { ...laneCluster.positions };
    const placedBounds = [laneCluster.bounds];
    let clusterBounds = laneCluster.bounds;

    for (const attachment of
      attachmentStructure.childrenByLaneId.get(laneId) ?? []) {
      const child = buildCluster(attachment.laneId);
      const anchorPosition = laneCluster.positions[attachment.anchorNodeId];
      const anchorMetrics = metrics.get(attachment.anchorNodeId);
      const childFirstPosition = child.positions[child.rootFirstNodeId];
      if (!anchorPosition || !anchorMetrics || !childFirstPosition) continue;
      const inlineOffset =
        anchorPosition.inline +
        anchorMetrics.inlineSize +
        ATTACH_INLINE_GAP -
        childFirstPosition.inline;
      const sideCandidates = attachment.side
        ? [attachment.side]
        : branchSideBias === "above"
          ? (["above", "below"] as const)
          : (["below", "above"] as const);
      const placements = sideCandidates.map((side) =>
        findChildPlacement(
          child.bounds,
          inlineOffset,
          side,
          laneCluster.bounds,
          placedBounds,
          anchorPosition,
          childFirstPosition,
        ),
      );
      const placement = attachment.side
        ? placements[0]
        : placements.reduce((best, current) =>
            current.cost < best.cost ? current : best,
          );
      Object.entries(child.positions).forEach(([nodeId, position]) => {
        positions[nodeId] = {
          inline: position.inline + placement.inlineOffset,
          cross: position.cross + placement.crossOffset,
        };
      });
      placedBounds.push(placement.bounds);
      clusterBounds = unionBounds(clusterBounds, placement.bounds);
    }

    const normalized = normalizeCluster({
      positions,
      bounds: clusterBounds,
      rootFirstNodeId: lane.nodeIds[0],
    });
    clusterCache.set(laneId, normalized);
    return normalized;
  };

  const rootClusters = attachmentStructure.roots.map(buildCluster);
  return packRootClusters(rootClusters, rootShelfFactor);
}

function layoutLaneBlocks(
  blocks: SemanticBlock[],
  maxNodesPerRow: number,
): PositionedCluster {
  const rows = buildLaneRows(blocks, maxNodesPerRow);
  const positions: Record<string, CanonicalPosition> = {};
  let crossOffset = 0;
  let maxInline = 0;
  rows.forEach((row) => {
    const rowCrossSize = Math.max(...row.blocks.map((block) => block.crossSize));
    let inlineOffset = 0;
    row.blocks.forEach((block) => {
      block.nodeIds.forEach((nodeId) => {
        const nodeOffset = block.nodeOffsets[nodeId];
        positions[nodeId] = {
          inline: inlineOffset + nodeOffset.inline,
          cross:
            crossOffset +
            (rowCrossSize - block.crossSize) / 2 +
            nodeOffset.cross,
        };
      });
      inlineOffset += block.inlineSize + BLOCK_INLINE_GAP;
    });
    maxInline = Math.max(maxInline, Math.max(0, inlineOffset - BLOCK_INLINE_GAP));
    crossOffset += rowCrossSize + LANE_ROW_GAP;
  });
  const maxCross = Math.max(0, crossOffset - LANE_ROW_GAP);
  return {
    positions,
    bounds: {
      minInline: 0,
      minCross: 0,
      maxInline,
      maxCross,
    },
    rootFirstNodeId: blocks[0]?.nodeIds[0] ?? "",
  };
}

function buildLaneRows(
  blocks: SemanticBlock[],
  maxNodesPerRow: number,
): LaneRow[] {
  const rows: LaneRow[] = [];
  let current: LaneRow = { blocks: [], nodeCount: 0 };
  blocks.forEach((block) => {
    if (
      current.blocks.length > 0 &&
      current.nodeCount + block.nodeIds.length > maxNodesPerRow
    ) {
      rows.push(current);
      current = { blocks: [], nodeCount: 0 };
    }
    current.blocks.push(block);
    current.nodeCount += block.nodeIds.length;
  });
  if (current.blocks.length > 0) rows.push(current);
  return rows;
}

function findChildPlacement(
  childBounds: CanonicalBounds,
  inlineOffset: number,
  side: LaneAttachmentSide,
  parentBounds: CanonicalBounds,
  placedBounds: CanonicalBounds[],
  anchorPosition: CanonicalPosition,
  childFirstPosition: CanonicalPosition,
): {
  inlineOffset: number;
  crossOffset: number;
  bounds: CanonicalBounds;
  cost: number;
} {
  let crossOffset =
    side === "above"
      ? parentBounds.minCross - ATTACH_CROSS_GAP - childBounds.maxCross
      : parentBounds.maxCross + ATTACH_CROSS_GAP - childBounds.minCross;
  let bounds = offsetBounds(childBounds, inlineOffset, crossOffset);
  for (;;) {
    const conflicts = placedBounds.filter((placed) =>
      boundsIntersect(bounds, placed),
    );
    if (conflicts.length === 0) break;
    crossOffset =
      side === "above"
        ? Math.min(...conflicts.map((conflict) => conflict.minCross)) -
          ATTACH_CROSS_GAP -
          childBounds.maxCross
        : Math.max(...conflicts.map((conflict) => conflict.maxCross)) +
          ATTACH_CROSS_GAP -
          childBounds.minCross;
    bounds = offsetBounds(childBounds, inlineOffset, crossOffset);
  }
  const expanded = unionBounds(parentBounds, bounds);
  const anchorDistance =
    Math.abs(
      childFirstPosition.inline + inlineOffset - anchorPosition.inline,
    ) +
    Math.abs(childFirstPosition.cross + crossOffset - anchorPosition.cross);
  return {
    inlineOffset,
    crossOffset,
    bounds,
    cost:
      boundsCrossSize(expanded) * 4 +
      boundsInlineSize(expanded) +
      anchorDistance,
  };
}

function packRootClusters(
  clusters: PositionedCluster[],
  shelfFactor: number,
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const totalArea = clusters.reduce(
    (sum, cluster) =>
      sum + boundsInlineSize(cluster.bounds) * boundsCrossSize(cluster.bounds),
    0,
  );
  const widestCluster = Math.max(
    0,
    ...clusters.map((cluster) => boundsInlineSize(cluster.bounds)),
  );
  const targetInlineSize = Math.max(
    widestCluster,
    Math.sqrt(totalArea * TARGET_ASPECT_RATIO) * shelfFactor,
  );
  let inlineCursor = 0;
  let crossOffset = 0;
  let shelfCrossSize = 0;
  clusters.forEach((cluster) => {
    const clusterInlineSize = boundsInlineSize(cluster.bounds);
    const clusterCrossSize = boundsCrossSize(cluster.bounds);
    if (
      inlineCursor > 0 &&
      inlineCursor + clusterInlineSize > targetInlineSize
    ) {
      crossOffset += shelfCrossSize + ROOT_CLUSTER_GAP;
      inlineCursor = 0;
      shelfCrossSize = 0;
    }
    Object.entries(cluster.positions).forEach(([nodeId, position]) => {
      positions[nodeId] = {
        x: inlineCursor + position.inline,
        y: crossOffset + position.cross,
      };
    });
    inlineCursor += clusterInlineSize + ROOT_CLUSTER_GAP;
    shelfCrossSize = Math.max(shelfCrossSize, clusterCrossSize);
  });
  return positions;
}

function normalizeCluster(cluster: PositionedCluster): PositionedCluster {
  const inlineOffset = -cluster.bounds.minInline;
  const crossOffset = -cluster.bounds.minCross;
  return {
    positions: Object.fromEntries(
      Object.entries(cluster.positions).map(([nodeId, position]) => [
        nodeId,
        {
          inline: position.inline + inlineOffset,
          cross: position.cross + crossOffset,
        },
      ]),
    ),
    bounds: offsetBounds(cluster.bounds, inlineOffset, crossOffset),
    rootFirstNodeId: cluster.rootFirstNodeId,
  };
}

function offsetBounds(
  bounds: CanonicalBounds,
  inlineOffset: number,
  crossOffset: number,
): CanonicalBounds {
  return {
    minInline: bounds.minInline + inlineOffset,
    minCross: bounds.minCross + crossOffset,
    maxInline: bounds.maxInline + inlineOffset,
    maxCross: bounds.maxCross + crossOffset,
  };
}

function unionBounds(
  left: CanonicalBounds,
  right: CanonicalBounds,
): CanonicalBounds {
  return {
    minInline: Math.min(left.minInline, right.minInline),
    minCross: Math.min(left.minCross, right.minCross),
    maxInline: Math.max(left.maxInline, right.maxInline),
    maxCross: Math.max(left.maxCross, right.maxCross),
  };
}

function boundsIntersect(
  left: CanonicalBounds,
  right: CanonicalBounds,
): boolean {
  return !(
    left.maxInline <= right.minInline ||
    right.maxInline <= left.minInline ||
    left.maxCross <= right.minCross ||
    right.maxCross <= left.minCross
  );
}

function boundsInlineSize(bounds: CanonicalBounds): number {
  return bounds.maxInline - bounds.minInline;
}

function boundsCrossSize(bounds: CanonicalBounds): number {
  return bounds.maxCross - bounds.minCross;
}
