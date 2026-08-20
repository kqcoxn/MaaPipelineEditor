import type { SemanticLayoutContext } from "../semantic-layout/types";

export type BusinessStageKind =
  | "main"
  | "branch"
  | "error"
  | "loop"
  | "support";

export type BusinessTransitionKind = "next" | "on_error" | "jump_back";

export interface BusinessArchitectureStageIntent {
  id: string;
  title: string;
  description: string;
  kind: BusinessStageKind;
  nodeIds: string[];
}

export interface BusinessArchitectureIntent {
  title: string;
  summary: string;
  stages: BusinessArchitectureStageIntent[];
}

export interface BusinessArchitectureTransition {
  id: string;
  sourceStageId: string;
  targetStageId: string;
  kind: BusinessTransitionKind;
  order: number;
  edgeCount: number;
}

export interface BusinessArchitectureDocument
  extends BusinessArchitectureIntent {
  fileName: string;
  sourceRunId: string;
  sourceStateVersion: number;
  sourceSignature: string;
  generatedAt: number;
  transitions: BusinessArchitectureTransition[];
  coverage: {
    includedNodeCount: number;
    totalNodeCount: number;
    autoAssignedNodeIds: string[];
  };
}

export interface BusinessArchitectureContext
  extends Omit<SemanticLayoutContext, "nodes"> {
  sourceSignature: string;
  nodes: Array<
    SemanticLayoutContext["nodes"][number] & {
      recognitionSummary?: string;
      actionSummary?: string;
      businessHint?: string;
    }
  >;
}
