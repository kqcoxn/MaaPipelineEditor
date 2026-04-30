import { create } from "zustand";
import type { DebugNodeExecutionOverlay } from "../features/debug/nodeExecutionAnalysis";
import type { DebugTraceSummary } from "../features/debug/traceReducer";

interface DebugOverlayState {
  currentNodeId?: string;
  visitedNodeIds: Set<string>;
  succeededNodeIds: Set<string>;
  failedNodeIds: Set<string>;
  executedEdgeIds: Set<string>;
  candidateEdgeIds: Set<string>;
  selectedExecutionRecordId?: string;
  selectedExecutionNodeId?: string;
  selectedExecutionAttemptId?: string;
  selectedExecutionAttemptNodeId?: string;
  selectedExecutionAttemptEdgeIds: Set<string>;
  executionPathNodeIds: Set<string>;
  executionPathEdgeIds: Set<string>;
  executionCandidateEdgeIds: Set<string>;
  highlightedFailureNodeIds: Set<string>;
  highlightedSlowNodeIds: Set<string>;
  applyTraceSummary: (summary: DebugTraceSummary) => void;
  applyReplaySummary: (summary: DebugTraceSummary) => void;
  applyNodeExecutionOverlay: (overlay: DebugNodeExecutionOverlay) => void;
  clearNodeExecutionOverlay: () => void;
  clearOverlay: () => void;
}

export const useDebugOverlayStore = create<DebugOverlayState>((set) => ({
  visitedNodeIds: new Set(),
  succeededNodeIds: new Set(),
  failedNodeIds: new Set(),
  executedEdgeIds: new Set(),
  candidateEdgeIds: new Set(),
  selectedExecutionAttemptEdgeIds: new Set(),
  executionPathNodeIds: new Set(),
  executionPathEdgeIds: new Set(),
  executionCandidateEdgeIds: new Set(),
  highlightedFailureNodeIds: new Set(),
  highlightedSlowNodeIds: new Set(),

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

  applyNodeExecutionOverlay: (overlay) =>
    set({
      selectedExecutionRecordId: overlay.selectedExecutionRecordId,
      selectedExecutionNodeId: overlay.selectedExecutionNodeId,
      selectedExecutionAttemptId: overlay.selectedExecutionAttemptId,
      selectedExecutionAttemptNodeId: overlay.selectedExecutionAttemptNodeId,
      selectedExecutionAttemptEdgeIds: new Set(
        overlay.selectedExecutionAttemptEdgeIds,
      ),
      executionPathNodeIds: new Set(overlay.executionPathNodeIds),
      executionPathEdgeIds: new Set(overlay.executionPathEdgeIds),
      executionCandidateEdgeIds: new Set(overlay.executionCandidateEdgeIds),
      highlightedFailureNodeIds: new Set(overlay.highlightedFailureNodeIds),
      highlightedSlowNodeIds: new Set(overlay.highlightedSlowNodeIds),
    }),

  clearNodeExecutionOverlay: () =>
    set({
      selectedExecutionRecordId: undefined,
      selectedExecutionNodeId: undefined,
      selectedExecutionAttemptId: undefined,
      selectedExecutionAttemptNodeId: undefined,
      selectedExecutionAttemptEdgeIds: new Set(),
      executionPathNodeIds: new Set(),
      executionPathEdgeIds: new Set(),
      executionCandidateEdgeIds: new Set(),
      highlightedFailureNodeIds: new Set(),
      highlightedSlowNodeIds: new Set(),
    }),

  clearOverlay: () =>
    set({
      currentNodeId: undefined,
      visitedNodeIds: new Set(),
      succeededNodeIds: new Set(),
      failedNodeIds: new Set(),
      executedEdgeIds: new Set(),
      candidateEdgeIds: new Set(),
      selectedExecutionRecordId: undefined,
      selectedExecutionNodeId: undefined,
      selectedExecutionAttemptId: undefined,
      selectedExecutionAttemptNodeId: undefined,
      selectedExecutionAttemptEdgeIds: new Set(),
      executionPathNodeIds: new Set(),
      executionPathEdgeIds: new Set(),
      executionCandidateEdgeIds: new Set(),
      highlightedFailureNodeIds: new Set(),
      highlightedSlowNodeIds: new Set(),
    }),
}));
