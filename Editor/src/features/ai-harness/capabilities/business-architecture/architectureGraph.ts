import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type {
  BusinessArchitectureDocument,
  BusinessArchitectureStageIntent,
  BusinessTransitionKind,
} from "./types";

const NODE_WIDTH = 280;
const NODE_HEIGHT = 148;
const COLUMN_GAP = 128;
const ROW_GAP = 64;

export interface BusinessStageNodeData extends Record<string, unknown> {
  stage: BusinessArchitectureStageIntent;
}

export type BusinessStageNode = Node<BusinessStageNodeData, "businessStage">;

export interface BusinessArchitectureGraph {
  nodes: BusinessStageNode[];
  edges: Edge[];
}

export function buildBusinessArchitectureGraph(
  document: BusinessArchitectureDocument,
): BusinessArchitectureGraph {
  const ranks = calculateStageRanks(document);
  const stagesByRank = new Map<number, BusinessArchitectureStageIntent[]>();
  document.stages.forEach((stage) => {
    const rank = ranks.get(stage.id) ?? 0;
    stagesByRank.set(rank, [...(stagesByRank.get(rank) ?? []), stage]);
  });
  const positions = new Map<string, { x: number; y: number }>();
  stagesByRank.forEach((stages, rank) => {
    const orderedStages = [...stages].sort(
      (left, right) =>
        stageKindOrder(left.kind) - stageKindOrder(right.kind) ||
        document.stages.indexOf(left) - document.stages.indexOf(right),
    );
    orderedStages.forEach((stage, index) => {
      positions.set(stage.id, {
        x: rank * (NODE_WIDTH + COLUMN_GAP),
        y:
          (index - (orderedStages.length - 1) / 2) *
          (NODE_HEIGHT + ROW_GAP),
      });
    });
  });

  return {
    nodes: document.stages.map((stage) => ({
      id: stage.id,
      type: "businessStage",
      position: positions.get(stage.id) ?? { x: 0, y: 0 },
      data: { stage },
      style: { width: NODE_WIDTH, minHeight: NODE_HEIGHT },
      draggable: false,
      connectable: false,
    })),
    edges: document.transitions.map((transition) => ({
      id: transition.id,
      source: transition.sourceStageId,
      target: transition.targetStageId,
      type: "smoothstep",
      label: transitionLabel(transition.kind, transition.order),
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      className: `business-architecture-edge business-architecture-edge-${transition.kind}`,
      style: transitionStyle(transition.kind),
      labelStyle: { fontSize: 11, fontWeight: 500 },
      labelBgPadding: [5, 3],
      labelBgBorderRadius: 4,
    })),
  };
}

function calculateStageRanks(
  document: BusinessArchitectureDocument,
): Map<string, number> {
  const stageIds = document.stages.map((stage) => stage.id);
  const adjacency = new Map(
    stageIds.map((stageId) => [stageId, new Set<string>()]),
  );
  const edges = [...document.transitions].sort(
    (left, right) =>
      transitionPriority(left.kind) - transitionPriority(right.kind) ||
      left.order - right.order,
  );
  edges.forEach((edge) => {
    if (
      edge.sourceStageId === edge.targetStageId ||
      hasPath(adjacency, edge.targetStageId, edge.sourceStageId)
    ) {
      return;
    }
    adjacency.get(edge.sourceStageId)?.add(edge.targetStageId);
  });
  const indegree = new Map(stageIds.map((stageId) => [stageId, 0]));
  adjacency.forEach((targets) =>
    targets.forEach((targetId) =>
      indegree.set(targetId, (indegree.get(targetId) ?? 0) + 1),
    ),
  );
  const queue = stageIds.filter((stageId) => indegree.get(stageId) === 0);
  const ranks = new Map(stageIds.map((stageId) => [stageId, 0]));
  for (let index = 0; index < queue.length; index += 1) {
    const sourceId = queue[index];
    adjacency.get(sourceId)?.forEach((targetId) => {
      ranks.set(
        targetId,
        Math.max(ranks.get(targetId) ?? 0, (ranks.get(sourceId) ?? 0) + 1),
      );
      const nextIndegree = (indegree.get(targetId) ?? 0) - 1;
      indegree.set(targetId, nextIndegree);
      if (nextIndegree === 0) queue.push(targetId);
    });
  }
  return ranks;
}

function hasPath(
  adjacency: Map<string, Set<string>>,
  sourceId: string,
  targetId: string,
): boolean {
  const pending = [sourceId];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const currentId = pending.pop()!;
    if (currentId === targetId) return true;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    adjacency.get(currentId)?.forEach((nextId) => pending.push(nextId));
  }
  return false;
}

function stageKindOrder(kind: BusinessArchitectureStageIntent["kind"]): number {
  return { main: 0, loop: 1, branch: 2, error: 3, support: 4 }[kind];
}

function transitionPriority(kind: BusinessTransitionKind): number {
  return { next: 0, jump_back: 1, on_error: 2 }[kind];
}

function transitionLabel(
  kind: BusinessTransitionKind,
  order: number,
): string | undefined {
  if (kind === "on_error") return "异常";
  if (kind === "jump_back") return "回跳";
  return order > 1 ? `候选 ${order}` : undefined;
}

function transitionStyle(kind: BusinessTransitionKind): {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
} {
  if (kind === "on_error") {
    return { stroke: "#c94a5a", strokeWidth: 1.8 };
  }
  if (kind === "jump_back") {
    return { stroke: "#b47a22", strokeWidth: 1.8, strokeDasharray: "6 4" };
  }
  return { stroke: "#50706a", strokeWidth: 1.8 };
}
