import type { EdgeType } from "@/stores/flow";
import type {
  SemanticLayoutLane,
  SemanticLayoutRelation,
} from "./types";

export type LaneAttachmentSide = "above" | "below";

export interface LaneAttachment {
  laneId: string;
  parentLaneId: string;
  anchorNodeId: string;
  side?: LaneAttachmentSide;
}

export interface LaneAttachmentStructure {
  roots: string[];
  attachments: LaneAttachment[];
  childrenByLaneId: Map<string, LaneAttachment[]>;
}

interface AttachmentCandidate extends LaneAttachment {
  laneIndex: number;
}

export function buildLaneAttachments(
  lanes: SemanticLayoutLane[],
  edges: EdgeType[],
  relations: SemanticLayoutRelation[],
): LaneAttachmentStructure {
  const nodeToLane = new Map<string, string>();
  lanes.forEach((lane) =>
    lane.nodeIds.forEach((nodeId) => nodeToLane.set(nodeId, lane.id)),
  );
  const candidates = lanes
    .map((lane, laneIndex) =>
      buildAttachmentCandidate(
        lane,
        laneIndex,
        edges,
        relations,
        nodeToLane,
      ),
    )
    .filter(
      (candidate): candidate is AttachmentCandidate =>
        candidate !== undefined,
    );
  const parentByLaneId = new Map<string, string>();
  const attachments: LaneAttachment[] = [];
  candidates
    .sort((left, right) => left.laneIndex - right.laneIndex)
    .forEach(({ laneIndex: _laneIndex, ...candidate }) => {
      if (wouldCreateCycle(candidate, parentByLaneId)) return;
      parentByLaneId.set(candidate.laneId, candidate.parentLaneId);
      attachments.push(candidate);
    });
  const childrenByLaneId = new Map(
    lanes.map((lane) => [lane.id, [] as LaneAttachment[]]),
  );
  attachments.forEach((attachment) => {
    childrenByLaneId.get(attachment.parentLaneId)?.push(attachment);
  });
  return {
    roots: lanes
      .map((lane) => lane.id)
      .filter((laneId) => !parentByLaneId.has(laneId)),
    attachments,
    childrenByLaneId,
  };
}

function buildAttachmentCandidate(
  lane: SemanticLayoutLane,
  laneIndex: number,
  edges: EdgeType[],
  relations: SemanticLayoutRelation[],
  nodeToLane: Map<string, string>,
): AttachmentCandidate | undefined {
  const explicitAnchor = lane.anchorNodeId;
  const inferredAnchor =
    explicitAnchor ?? inferControlEdgeAnchor(lane, edges, nodeToLane);
  if (!inferredAnchor) return undefined;
  const parentLaneId = nodeToLane.get(inferredAnchor);
  if (!parentLaneId || parentLaneId === lane.id) return undefined;
  return {
    laneId: lane.id,
    parentLaneId,
    anchorNodeId: inferredAnchor,
    side:
      explicitRelationSide(parentLaneId, lane.id, relations) ??
      defaultRoleSide(lane),
    laneIndex,
  };
}

function inferControlEdgeAnchor(
  lane: SemanticLayoutLane,
  edges: EdgeType[],
  nodeToLane: Map<string, string>,
): string | undefined {
  if (lane.role === "primary" || lane.role === "support") return undefined;
  const nodeOrder = new Map(
    lane.nodeIds.map((nodeId, index) => [nodeId, index]),
  );
  return edges
    .map((edge, edgeIndex) => ({ edge, edgeIndex }))
    .filter(({ edge }) => {
      const targetOrder = nodeOrder.get(edge.target);
      return (
        targetOrder !== undefined &&
        nodeToLane.get(edge.source) !== undefined &&
        nodeToLane.get(edge.source) !== lane.id
      );
    })
    .sort((left, right) => {
      const kindDifference =
        edgeRolePriority(lane, left.edge) -
        edgeRolePriority(lane, right.edge);
      if (kindDifference !== 0) return kindDifference;
      const targetDifference =
        nodeOrder.get(left.edge.target)! - nodeOrder.get(right.edge.target)!;
      if (targetDifference !== 0) return targetDifference;
      const orderDifference = edgeOrder(left.edge) - edgeOrder(right.edge);
      return orderDifference || left.edgeIndex - right.edgeIndex;
    })[0]?.edge.source;
}

function edgeRolePriority(
  lane: SemanticLayoutLane,
  edge: EdgeType,
): number {
  const isError = edge.sourceHandle === "on_error";
  const isJumpBack =
    Boolean(edge.attributes?.jump_back) || edge.targetHandle === "jump_back";
  if (lane.role === "error") return isError ? 0 : 3;
  if (lane.role === "jump_back") return isJumpBack ? 0 : 3;
  return !isError && !isJumpBack ? 0 : 2;
}

function edgeOrder(edge: EdgeType): number {
  return typeof edge.label === "number" ? edge.label : Number.MAX_SAFE_INTEGER;
}

function explicitRelationSide(
  parentLaneId: string,
  childLaneId: string,
  relations: SemanticLayoutRelation[],
): LaneAttachmentSide | undefined {
  for (const relation of relations) {
    if (
      relation.sourceLaneId === parentLaneId &&
      relation.targetLaneId === childLaneId
    ) {
      if (relation.placement === "above") return "above";
      if (relation.placement === "below") return "below";
    }
    if (
      relation.sourceLaneId === childLaneId &&
      relation.targetLaneId === parentLaneId
    ) {
      if (relation.placement === "above") return "below";
      if (relation.placement === "below") return "above";
    }
  }
  return undefined;
}

function defaultRoleSide(
  lane: SemanticLayoutLane,
): LaneAttachmentSide | undefined {
  if (lane.role === "jump_back") return "above";
  if (lane.role === "error") return "below";
  return undefined;
}

function wouldCreateCycle(
  candidate: LaneAttachment,
  parentByLaneId: Map<string, string>,
): boolean {
  let currentLaneId: string | undefined = candidate.parentLaneId;
  while (currentLaneId) {
    if (currentLaneId === candidate.laneId) return true;
    currentLaneId = parentByLaneId.get(currentLaneId);
  }
  return false;
}
