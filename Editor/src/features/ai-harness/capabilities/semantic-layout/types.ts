import type { CanvasGraphState } from "../canvas/commandBus";

export type SemanticLayoutDirection = "RIGHT" | "DOWN";
export type SemanticLaneRole =
  | "primary"
  | "branch"
  | "jump_back"
  | "error"
  | "support";
export type SemanticRelationPlacement =
  | "before"
  | "after"
  | "above"
  | "below"
  | "near";

export interface SemanticLayoutLane {
  id: string;
  role: SemanticLaneRole;
  nodeIds: string[];
  anchorNodeId?: string;
}

export interface SemanticLayoutRelation {
  sourceLaneId: string;
  targetLaneId: string;
  placement: SemanticRelationPlacement;
}

export interface SemanticLayoutIntent {
  direction: SemanticLayoutDirection;
  lanes: SemanticLayoutLane[];
  relations: SemanticLayoutRelation[];
}

export interface SemanticControlEdge {
  id: string;
  sourceId: string;
  targetId: string;
  kind: "next" | "on_error" | "jump_back";
  order: number;
  returnsToSource: boolean;
}

export interface SemanticCandidateSet {
  sourceId: string;
  kind: "next" | "on_error";
  candidates: Array<{
    nodeId: string;
    order: number;
    jumpBack: boolean;
  }>;
}

export interface SemanticNodeReference {
  sourceId: string;
  field: string;
  reference: string;
  targetNodeIds: string[];
  dynamicAnchor: boolean;
}

export interface SemanticLayoutContext {
  fileName: string;
  stateVersion: number;
  layoutableNodeIds: string[];
  excludedNodeIds: string[];
  nodes: Array<{
    id: string;
    name: string;
    type: string;
    recognition?: string;
    action?: string;
    width: number;
    height: number;
    entry: boolean;
  }>;
  controlEdges: SemanticControlEdge[];
  candidateSets: SemanticCandidateSet[];
  stronglyConnectedComponents: string[][];
  references: SemanticNodeReference[];
}

export interface SemanticLayoutResult {
  positions: Record<string, { x: number; y: number }>;
  laneCount: number;
  autoAssignedNodeIds: string[];
}

export interface SemanticLayoutSource {
  graph: CanvasGraphState;
  stateVersion: number;
}
