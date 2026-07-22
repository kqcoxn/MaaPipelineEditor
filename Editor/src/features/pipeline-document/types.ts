import type { Node as JsoncNode } from "jsonc-parser";
import type { Viewport } from "@xyflow/react";

import type { FileConfigType } from "../../stores/fileStore";
import type { EdgeType, NodeType } from "../../stores/flow";

export type PipelineViewMode = "flow" | "source";
export type PipelineParseState = "valid" | "invalid";
export type PipelineProjectionStatus = "ready" | "partial" | "unavailable";

export interface PipelineSourceRange {
  offset: number;
  length: number;
}

export interface PipelineSourceLocation {
  path: Array<string | number>;
  value: PipelineSourceRange;
  key?: PipelineSourceRange;
}

export interface PipelineSourceMap {
  locations: PipelineSourceLocation[];
}

export interface PipelineFlowProjection {
  nodes: NodeType[];
  edges: EdgeType[];
  config: FileConfigType;
  hasAuthoredPositions: boolean;
}

export interface PipelineDocumentState {
  viewMode: PipelineViewMode;
  parseState: PipelineParseState;
  projectionStatus: PipelineProjectionStatus;
  syntaxTree?: JsoncNode;
  sourceMap?: PipelineSourceMap;
  projection?: PipelineFlowProjection;
  lastValidProjection?: PipelineFlowProjection;
  viewport?: Viewport;
  parsedWorkingRevision: number;
}
