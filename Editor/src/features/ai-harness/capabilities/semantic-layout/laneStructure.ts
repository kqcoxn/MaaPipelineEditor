import type { EdgeType } from "@/stores/flow";
import type { SemanticLayoutLane, SemanticLayoutRelation } from "./types";

interface DirectedPair {
  source: string;
  target: string;
  priority: number;
  order: number;
}

export interface LaneStructure {
  ranks: Map<string, number>;
  orderedLanes: SemanticLayoutLane[];
  laneNodeOrder: Map<string, number>;
}

export function buildLaneStructure(
  nodeIds: string[],
  edges: EdgeType[],
  lanes: SemanticLayoutLane[],
  relations: SemanticLayoutRelation[],
): LaneStructure {
  const validNodeIds = new Set(nodeIds);
  const nodeToLane = buildNodeToLane(lanes);
  const laneNodeOrder = buildLaneNodeOrder(lanes);
  const pairs = buildDirectedPairs(
    edges,
    lanes,
    relations,
    validNodeIds,
    nodeToLane,
    laneNodeOrder,
  );
  return {
    ranks: calculateRanks(nodeIds, pairs),
    orderedLanes: orderLanes(lanes, relations, nodeToLane, edges),
    laneNodeOrder,
  };
}

function buildNodeToLane(lanes: SemanticLayoutLane[]): Map<string, string> {
  const result = new Map<string, string>();
  lanes.forEach((lane) =>
    lane.nodeIds.forEach((nodeId) => result.set(nodeId, lane.id)),
  );
  return result;
}

function buildLaneNodeOrder(
  lanes: SemanticLayoutLane[],
): Map<string, number> {
  const result = new Map<string, number>();
  lanes.forEach((lane) =>
    lane.nodeIds.forEach((nodeId, index) => result.set(nodeId, index)),
  );
  return result;
}

function buildDirectedPairs(
  edges: EdgeType[],
  lanes: SemanticLayoutLane[],
  relations: SemanticLayoutRelation[],
  nodeIds: Set<string>,
  nodeToLane: Map<string, string>,
  laneNodeOrder: Map<string, number>,
): DirectedPair[] {
  const pairs: DirectedPair[] = edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => {
      const sameLane =
        nodeToLane.get(edge.source) === nodeToLane.get(edge.target);
      const followsLaneOrder =
        sameLane &&
        (laneNodeOrder.get(edge.target) ?? 0) >
          (laneNodeOrder.get(edge.source) ?? 0);
      return {
        source: edge.source,
        target: edge.target,
        priority: followsLaneOrder
          ? 0
          : edge.sourceHandle === "on_error"
            ? 3
            : 1,
        order: edge.label,
      };
    });
  addAnchorPairs(pairs, lanes, nodeIds);
  addFlowRelationPairs(pairs, lanes, relations);
  return pairs;
}

function addAnchorPairs(
  pairs: DirectedPair[],
  lanes: SemanticLayoutLane[],
  nodeIds: Set<string>,
): void {
  lanes.forEach((lane) => {
    if (!lane.anchorNodeId || !nodeIds.has(lane.anchorNodeId)) return;
    const firstNodeId = lane.nodeIds[0];
    if (!firstNodeId || firstNodeId === lane.anchorNodeId) return;
    pairs.push({
      source: lane.anchorNodeId,
      target: firstNodeId,
      priority: 2,
      order: 0,
    });
  });
}

function addFlowRelationPairs(
  pairs: DirectedPair[],
  lanes: SemanticLayoutLane[],
  relations: SemanticLayoutRelation[],
): void {
  const laneMap = new Map(lanes.map((lane) => [lane.id, lane]));
  relations.forEach((relation) => {
    if (relation.placement !== "before" && relation.placement !== "after") {
      return;
    }
    const sourceLane = laneMap.get(relation.sourceLaneId);
    const targetLane = laneMap.get(relation.targetLaneId);
    if (!sourceLane || !targetLane) return;
    const beforeLane =
      relation.placement === "before" ? targetLane : sourceLane;
    const afterLane =
      relation.placement === "before" ? sourceLane : targetLane;
    const source = beforeLane.nodeIds.at(-1);
    const target = afterLane.nodeIds[0];
    if (source && target) {
      pairs.push({ source, target, priority: 4, order: 0 });
    }
  });
}

function calculateRanks(
  nodeIds: string[],
  requestedPairs: DirectedPair[],
): Map<string, number> {
  const adjacency = new Map(
    nodeIds.map((nodeId) => [nodeId, new Set<string>()]),
  );
  const pairs = [...requestedPairs].sort(
    (left, right) =>
      left.priority - right.priority || left.order - right.order,
  );
  pairs.forEach(({ source, target }) => {
    if (source === target || hasPath(adjacency, target, source)) return;
    adjacency.get(source)?.add(target);
  });

  const indegree = new Map(nodeIds.map((nodeId) => [nodeId, 0]));
  adjacency.forEach((targets) =>
    targets.forEach((target) =>
      indegree.set(target, indegree.get(target)! + 1),
    ),
  );
  const queue = nodeIds.filter((nodeId) => indegree.get(nodeId) === 0);
  const ranks = new Map(nodeIds.map((nodeId) => [nodeId, 0]));
  for (let index = 0; index < queue.length; index += 1) {
    const source = queue[index];
    adjacency.get(source)?.forEach((target) => {
      ranks.set(
        target,
        Math.max(ranks.get(target)!, ranks.get(source)! + 1),
      );
      const nextIndegree = indegree.get(target)! - 1;
      indegree.set(target, nextIndegree);
      if (nextIndegree === 0) queue.push(target);
    });
  }
  return ranks;
}

function hasPath(
  adjacency: Map<string, Set<string>>,
  source: string,
  target: string,
): boolean {
  const pending = [source];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current === target) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    adjacency.get(current)?.forEach((next) => pending.push(next));
  }
  return false;
}

function orderLanes(
  lanes: SemanticLayoutLane[],
  relations: SemanticLayoutRelation[],
  nodeToLane: Map<string, string>,
  edges: EdgeType[],
): SemanticLayoutLane[] {
  const constraints = new Map(
    lanes.map((lane) => [lane.id, new Set<string>()]),
  );
  addExplicitCrossAxisConstraints(constraints, relations);
  addRoleConstraints(constraints, lanes, nodeToLane);
  addCandidateOrderConstraints(constraints, lanes, edges, nodeToLane);
  return stableTopologicalSort(lanes, constraints);
}

function addExplicitCrossAxisConstraints(
  constraints: Map<string, Set<string>>,
  relations: SemanticLayoutRelation[],
): void {
  relations.forEach((relation) => {
    if (relation.placement === "above") {
      constraints.get(relation.targetLaneId)?.add(relation.sourceLaneId);
    }
    if (relation.placement === "below") {
      constraints.get(relation.sourceLaneId)?.add(relation.targetLaneId);
    }
  });
}

function addRoleConstraints(
  constraints: Map<string, Set<string>>,
  lanes: SemanticLayoutLane[],
  nodeToLane: Map<string, string>,
): void {
  lanes.forEach((lane) => {
    const anchorLaneId = lane.anchorNodeId
      ? nodeToLane.get(lane.anchorNodeId)
      : undefined;
    if (!anchorLaneId || anchorLaneId === lane.id) return;
    if (lane.role === "jump_back") {
      constraints.get(lane.id)?.add(anchorLaneId);
    }
    if (lane.role === "error") {
      constraints.get(anchorLaneId)?.add(lane.id);
    }
  });
}

function addCandidateOrderConstraints(
  constraints: Map<string, Set<string>>,
  lanes: SemanticLayoutLane[],
  edges: EdgeType[],
  nodeToLane: Map<string, string>,
): void {
  const laneMap = new Map(lanes.map((lane) => [lane.id, lane]));
  const candidatesBySource = new Map<string, EdgeType[]>();
  edges.forEach((edge) => {
    if (edge.sourceHandle === "on_error") return;
    const laneId = nodeToLane.get(edge.target);
    const lane = laneId ? laneMap.get(laneId) : undefined;
    if (!lane || lane.role === "jump_back" || lane.role === "error") return;
    candidatesBySource.set(edge.source, [
      ...(candidatesBySource.get(edge.source) ?? []),
      edge,
    ]);
  });
  candidatesBySource.forEach((candidates) => {
    const orderedLaneIds = candidates
      .sort((left, right) => left.label - right.label)
      .map((edge) => nodeToLane.get(edge.target))
      .filter((laneId): laneId is string => Boolean(laneId))
      .filter((laneId, index, values) => values.indexOf(laneId) === index);
    orderedLaneIds.slice(1).forEach((laneId, index) => {
      const previousLaneId = orderedLaneIds[index];
      if (previousLaneId !== laneId) {
        constraints.get(previousLaneId)?.add(laneId);
      }
    });
  });
}

function stableTopologicalSort(
  lanes: SemanticLayoutLane[],
  constraints: Map<string, Set<string>>,
): SemanticLayoutLane[] {
  const indegree = new Map(lanes.map((lane) => [lane.id, 0]));
  constraints.forEach((targets) =>
    targets.forEach((target) =>
      indegree.set(target, indegree.get(target)! + 1),
    ),
  );
  const originalIndex = new Map(lanes.map((lane, index) => [lane.id, index]));
  const pending = lanes.filter((lane) => indegree.get(lane.id) === 0);
  const result: SemanticLayoutLane[] = [];
  while (pending.length > 0) {
    pending.sort(
      (left, right) =>
        originalIndex.get(left.id)! - originalIndex.get(right.id)!,
    );
    const lane = pending.shift()!;
    result.push(lane);
    constraints.get(lane.id)?.forEach((targetId) => {
      const nextIndegree = indegree.get(targetId)! - 1;
      indegree.set(targetId, nextIndegree);
      if (nextIndegree === 0) {
        pending.push(lanes[originalIndex.get(targetId)!]);
      }
    });
  }
  if (result.length === lanes.length) return result;
  const placedIds = new Set(result.map((lane) => lane.id));
  return [...result, ...lanes.filter((lane) => !placedIds.has(lane.id))];
}
