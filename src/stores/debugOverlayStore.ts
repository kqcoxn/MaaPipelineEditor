import { create } from "zustand";
import type { DebugTraceSummary } from "../features/debug/traceReducer";

interface DebugOverlayState {
  currentNodeId?: string;
  visitedNodeIds: Set<string>;
  succeededNodeIds: Set<string>;
  failedNodeIds: Set<string>;
  executedEdgeIds: Set<string>;
  candidateEdgeIds: Set<string>;
  applyTraceSummary: (summary: DebugTraceSummary) => void;
  applyReplaySummary: (summary: DebugTraceSummary) => void;
  clearOverlay: () => void;
}

export const useDebugOverlayStore = create<DebugOverlayState>((set) => ({
  visitedNodeIds: new Set(),
  succeededNodeIds: new Set(),
  failedNodeIds: new Set(),
  executedEdgeIds: new Set(),
  candidateEdgeIds: new Set(),

  applyTraceSummary: (summary) =>
    set({
      currentNodeId: summary.currentNodeId,
      visitedNodeIds: new Set(summary.visitedNodeIds),
      succeededNodeIds: new Set(summary.succeededNodeIds),
      failedNodeIds: new Set(summary.failedNodeIds),
      executedEdgeIds: new Set(summary.executedEdgeIds),
      candidateEdgeIds: new Set(summary.candidateEdgeIds),
    }),

  applyReplaySummary: (summary) =>
    set({
      currentNodeId: summary.currentNodeId,
      visitedNodeIds: new Set(summary.visitedNodeIds),
      succeededNodeIds: new Set(summary.succeededNodeIds),
      failedNodeIds: new Set(summary.failedNodeIds),
      executedEdgeIds: new Set(summary.executedEdgeIds),
      candidateEdgeIds: new Set(summary.candidateEdgeIds),
    }),

  clearOverlay: () =>
    set({
      currentNodeId: undefined,
      visitedNodeIds: new Set(),
      succeededNodeIds: new Set(),
      failedNodeIds: new Set(),
      executedEdgeIds: new Set(),
      candidateEdgeIds: new Set(),
    }),
}));
