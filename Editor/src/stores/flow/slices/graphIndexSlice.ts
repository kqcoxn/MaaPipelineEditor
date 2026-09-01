import type { StateCreator } from "zustand";
import type { FlowGraphIndexState, FlowStore } from "../types";

export const createGraphIndexSlice: StateCreator<
  FlowStore,
  [],
  [],
  FlowGraphIndexState
> = () => ({
  nodeById: new Map(),
  nodeSemanticById: new Map(),
  edgeById: new Map(),
  outgoingEdgeIdsByNodeId: new Map(),
  incomingEdgeIdsByNodeId: new Map(),
  nodeIdsByTypeAndLabel: new Map(),
  anchorReferenceIndex: new Map(),
  selectedNodeIds: new Set(),
  selectedEdgeIds: new Set(),
  selectedEdgeEndpointNodeIds: new Set(),
  hasSelectedSticker: false,
  graphRevision: 0,
  layoutRevision: 0,
  topologyRevision: 0,
  semanticRevision: 0,
  selectionRevision: 0,
});
