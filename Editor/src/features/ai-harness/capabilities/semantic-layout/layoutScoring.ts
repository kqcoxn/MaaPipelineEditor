import type { EdgeType } from "@/stores/flow";
import type { CanonicalNodeMetrics } from "./semanticBlocks";
import type { SemanticLayoutDirection } from "./types";

const TARGET_ASPECT_RATIO = 1.8;
const MAX_CROSSING_SCORE_EDGES = 300;

export interface LayoutScoringCandidate {
  positions: Record<string, { x: number; y: number }>;
  ranks: Map<string, number>;
  proximityPairs: Array<{ source: string; target: string }>;
}

interface Bounds {
  width: number;
  height: number;
}

export function scoreLayoutCandidate(
  candidate: LayoutScoringCandidate,
  edges: EdgeType[],
  direction: SemanticLayoutDirection,
  metrics: Map<string, CanonicalNodeMetrics>,
): number {
  const positions =
    direction === "RIGHT"
      ? candidate.positions
      : transposePositions(candidate.positions);
  const bounds = calculateBounds(positions, metrics);
  const aspectRatio = bounds.width / Math.max(1, bounds.height);
  const nodeArea = [...metrics.values()].reduce(
    (sum, node) => sum + node.inlineSize * node.crossSize,
    0,
  );
  const fillRatio = nodeArea / Math.max(1, bounds.width * bounds.height);
  return (
    Math.abs(Math.log(aspectRatio / TARGET_ASPECT_RATIO)) * 220 +
    (1 - Math.min(1, fillRatio)) * 60 +
    scoreEdges(
      positions,
      metrics,
      edges,
      candidate.ranks,
      candidate.proximityPairs,
    ) +
    scoreProximity(positions, metrics, candidate.proximityPairs)
  );
}

function scoreProximity(
  positions: Record<string, { x: number; y: number }>,
  metrics: Map<string, CanonicalNodeMetrics>,
  pairs: Array<{ source: string; target: string }>,
): number {
  const usablePairs = pairs.filter(
    (pair) => positions[pair.source] && positions[pair.target],
  );
  if (usablePairs.length === 0) return 0;
  const distances = usablePairs.map((pair) => {
    const source = centerOf(pair.source, positions, metrics);
    const target = centerOf(pair.target, positions, metrics);
    return Math.abs(target.x - source.x) + Math.abs(target.y - source.y);
  });
  const averageDistance =
    distances.reduce((sum, distance) => sum + distance, 0) /
    distances.length;
  const scale = averageNodeDiagonal(metrics);
  return (
    (averageDistance / scale) * 6 +
    (Math.max(...distances) / scale) * 10
  );
}

function calculateBounds(
  positions: Record<string, { x: number; y: number }>,
  metrics: Map<string, CanonicalNodeMetrics>,
): Bounds {
  const entries = Object.entries(positions);
  const minX = Math.min(...entries.map(([, position]) => position.x));
  const minY = Math.min(...entries.map(([, position]) => position.y));
  const maxX = Math.max(
    ...entries.map(
      ([nodeId, position]) => position.x + metrics.get(nodeId)!.inlineSize,
    ),
  );
  const maxY = Math.max(
    ...entries.map(
      ([nodeId, position]) => position.y + metrics.get(nodeId)!.crossSize,
    ),
  );
  return { width: maxX - minX, height: maxY - minY };
}

function scoreEdges(
  positions: Record<string, { x: number; y: number }>,
  metrics: Map<string, CanonicalNodeMetrics>,
  edges: EdgeType[],
  ranks: Map<string, number>,
  proximityPairs: Array<{ source: string; target: string }>,
): number {
  const usableEdges = edges.filter(
    (edge) => positions[edge.source] && positions[edge.target],
  );
  if (usableEdges.length === 0) return 0;
  const segments = sampleEvenly(usableEdges, MAX_CROSSING_SCORE_EDGES).map(
    (edge) => ({
      edge,
      source: centerOf(edge.source, positions, metrics),
      target: centerOf(edge.target, positions, metrics),
    }),
  );
  const edgeLengths = segments.map(
    (segment) =>
      Math.abs(segment.target.x - segment.source.x) +
      Math.abs(segment.target.y - segment.source.y),
  );
  const averageEdgeLength =
    edgeLengths.reduce((sum, length) => sum + length, 0) /
    edgeLengths.length;
  const tailEdgeLength = percentile(edgeLengths, 0.9);
  const proximityKeys = new Set(
    proximityPairs.map((pair) => `${pair.source}\u0000${pair.target}`),
  );
  const directionViolations = segments.filter(({ edge, source, target }) => {
    if (proximityKeys.has(`${edge.source}\u0000${edge.target}`)) return false;
    if ((ranks.get(edge.target) ?? 0) <= (ranks.get(edge.source) ?? 0)) {
      return false;
    }
    return target.y < source.y || (target.y === source.y && target.x < source.x);
  }).length;
  return (
    (averageEdgeLength / averageNodeDiagonal(metrics)) * 6 +
    (tailEdgeLength / averageNodeDiagonal(metrics)) * 5 +
    directionViolations * 35 +
    countEdgeCrossings(segments) * 12
  );
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function averageNodeDiagonal(
  metrics: Map<string, CanonicalNodeMetrics>,
): number {
  return Math.max(
    1,
    [...metrics.values()].reduce(
      (sum, node) => sum + Math.hypot(node.inlineSize, node.crossSize),
      0,
    ) / metrics.size,
  );
}

function sampleEvenly<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items;
  return Array.from({ length: limit }, (_, index) =>
    items[Math.floor((index * items.length) / limit)],
  );
}

function centerOf(
  nodeId: string,
  positions: Record<string, { x: number; y: number }>,
  metrics: Map<string, CanonicalNodeMetrics>,
): { x: number; y: number } {
  const position = positions[nodeId];
  const node = metrics.get(nodeId)!;
  return {
    x: position.x + node.inlineSize / 2,
    y: position.y + node.crossSize / 2,
  };
}

function countEdgeCrossings(
  segments: Array<{
    edge: EdgeType;
    source: { x: number; y: number };
    target: { x: number; y: number };
  }>,
): number {
  let crossings = 0;
  segments.forEach((left, index) => {
    segments.slice(index + 1).forEach((right) => {
      const sharesNode =
        left.edge.source === right.edge.source ||
        left.edge.source === right.edge.target ||
        left.edge.target === right.edge.source ||
        left.edge.target === right.edge.target;
      if (!sharesNode && segmentsIntersect(left, right)) crossings += 1;
    });
  });
  return crossings;
}

function segmentsIntersect(
  left: { source: { x: number; y: number }; target: { x: number; y: number } },
  right: { source: { x: number; y: number }; target: { x: number; y: number } },
): boolean {
  const first = orientation(left.source, left.target, right.source);
  const second = orientation(left.source, left.target, right.target);
  const third = orientation(right.source, right.target, left.source);
  const fourth = orientation(right.source, right.target, left.target);
  return first * second < 0 && third * fourth < 0;
}

function orientation(
  start: { x: number; y: number },
  end: { x: number; y: number },
  point: { x: number; y: number },
): number {
  return (
    (end.x - start.x) * (point.y - start.y) -
    (end.y - start.y) * (point.x - start.x)
  );
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
