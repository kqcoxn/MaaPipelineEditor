import type { StateCreator } from "zustand";

import { useConfigStore } from "@/stores/app/configStore";
import {
  useOperationLogStore,
  type OperationDescriptor,
} from "@/stores/flow/operationLogStore";
import type {
  EdgeType,
  FlowGraphHistoryPatch,
  FlowHistoryEntry,
  FlowHistoryState,
  FlowStore,
  NodeType,
} from "../types";
import {
  applyGraphHistoryPatch,
  createGraphHistoryPatch,
  hasGraphHistoryChanges,
} from "../utils/historyPatch";
import { ensureGroupNodeOrder } from "../utils/nodeUtils";

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

const BASELINE_ENTRY: FlowHistoryEntry = { kind: "baseline" };

function clearSaveTimeout() {
  if (saveTimeout === null) return;
  clearTimeout(saveTimeout);
  saveTimeout = null;
}

function normalizeHistoryLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 100;
  return Math.max(1, Math.trunc(limit));
}

function appendPatch(
  historyStack: FlowHistoryEntry[],
  historyIndex: number,
  patch: FlowGraphHistoryPatch,
  limit: number,
): { historyStack: FlowHistoryEntry[]; historyIndex: number } {
  let nextStack = historyStack.slice(0, historyIndex + 1);
  let nextIndex = historyIndex;

  if (nextStack.length === 0) {
    nextStack.push(BASELINE_ENTRY);
    nextIndex = 0;
  }

  nextStack.push({ kind: "patch", patch });
  nextIndex += 1;

  const normalizedLimit = normalizeHistoryLimit(limit);
  if (nextStack.length > normalizedLimit) {
    const removeCount = nextStack.length - normalizedLimit;
    nextStack = nextStack.slice(removeCount);
    nextStack[0] = BASELINE_ENTRY;
    nextIndex -= removeCount;
  }

  return { historyStack: nextStack, historyIndex: nextIndex };
}

function trimHistoryWindow(
  historyStack: FlowHistoryEntry[],
  historyIndex: number,
  limit: number,
): { historyStack: FlowHistoryEntry[]; historyIndex: number } {
  const normalizedLimit = normalizeHistoryLimit(limit);
  if (historyStack.length <= normalizedLimit) {
    return { historyStack, historyIndex };
  }

  const latestWindowStart = historyStack.length - normalizedLimit;
  const start = Math.min(latestWindowStart, Math.max(0, historyIndex));
  const nextStack = historyStack.slice(start, start + normalizedLimit);
  nextStack[0] = BASELINE_ENTRY;
  return {
    historyStack: nextStack,
    historyIndex: Math.max(0, historyIndex - start),
  };
}

function addOperationLog(opDescriptor: OperationDescriptor | undefined) {
  if (!opDescriptor) return;
  useOperationLogStore.getState().addLog({
    category: opDescriptor.category,
    action: opDescriptor.action,
    description: opDescriptor.description,
    targetIds: opDescriptor.targetIds,
  });
}

function clearGraphSelection(nodes: NodeType[], edges: EdgeType[]) {
  return {
    nodes: nodes.map((node) => ({
      ...node,
      selected: false,
      dragging: false,
    })),
    edges: edges.map((edge) => ({ ...edge, selected: false })),
  };
}

export const createHistorySlice: StateCreator<
  FlowStore,
  [],
  [],
  FlowHistoryState
> = (set, get) => ({
  historyStack: [],
  historyIndex: -1,
  historyBaseline: {
    nodes: [],
    edges: [],
    graphRevision: 0,
  },

  saveHistory(delay: number = 500, opDescriptor?: OperationDescriptor) {
    clearSaveTimeout();

    saveTimeout = setTimeout(() => {
      saveTimeout = null;
      const currentState = get();
      const baseline = currentState.historyBaseline;
      if (baseline.graphRevision === currentState.graphRevision) return;

      const patch = createGraphHistoryPatch(
        baseline.nodes,
        baseline.edges,
        currentState.nodes,
        currentState.edges,
      );
      const historyBaseline = {
        nodes: currentState.nodes,
        edges: currentState.edges,
        graphRevision: currentState.graphRevision,
      };

      if (!hasGraphHistoryChanges(patch)) {
        set({ historyBaseline });
        return;
      }

      addOperationLog(opDescriptor);
      const limit = useConfigStore.getState().configs.historyLimit;
      set((state) => ({
        ...appendPatch(
          state.historyStack,
          state.historyIndex,
          patch,
          limit,
        ),
        historyBaseline,
      }));
    }, delay);
  },

  undo() {
    const state = get();
    if (state.historyIndex <= 0) return false;

    clearSaveTimeout();
    const entry = state.historyStack[state.historyIndex];
    if (entry.kind !== "patch") return false;

    const patched = applyGraphHistoryPatch(
      state.nodes,
      state.edges,
      entry.patch,
      "undo",
    );
    const graph = clearGraphSelection(patched.nodes, patched.edges);
    get().replace(graph.nodes, graph.edges, {
      isFitView: false,
      skipHistory: true,
    });

    const currentState = get();
    set({
      historyIndex: state.historyIndex - 1,
      historyBaseline: {
        nodes: currentState.nodes,
        edges: currentState.edges,
        graphRevision: currentState.graphRevision,
      },
    });
    return true;
  },

  redo() {
    const state = get();
    if (state.historyIndex >= state.historyStack.length - 1) return false;

    clearSaveTimeout();
    const entry = state.historyStack[state.historyIndex + 1];
    if (entry.kind !== "patch") return false;

    const patched = applyGraphHistoryPatch(
      state.nodes,
      state.edges,
      entry.patch,
      "redo",
    );
    const graph = clearGraphSelection(patched.nodes, patched.edges);
    get().replace(graph.nodes, graph.edges, {
      isFitView: false,
      skipHistory: true,
    });

    const currentState = get();
    set({
      historyIndex: state.historyIndex + 1,
      historyBaseline: {
        nodes: currentState.nodes,
        edges: currentState.edges,
        graphRevision: currentState.graphRevision,
      },
    });
    return true;
  },

  initHistory() {
    clearSaveTimeout();
    const state = get();
    set({
      historyStack: [BASELINE_ENTRY],
      historyIndex: 0,
      historyBaseline: {
        nodes: state.nodes,
        edges: state.edges,
        graphRevision: state.graphRevision,
      },
    });
  },

  importHistory(nodes: NodeType[], edges: EdgeType[]) {
    clearSaveTimeout();
    const state = get();
    const normalizedNodes = ensureGroupNodeOrder(nodes);

    if (state.historyStack.length === 0) {
      set({
        historyStack: [BASELINE_ENTRY],
        historyIndex: 0,
        historyBaseline: {
          nodes: normalizedNodes,
          edges,
          // importHistory 紧接着由 importer 调用一次 replace。
          graphRevision: state.graphRevision + 1,
        },
      });
      return;
    }

    const limit = useConfigStore.getState().configs.historyLimit;
    let historyState = {
      historyStack: state.historyStack,
      historyIndex: state.historyIndex,
    };

    if (state.historyBaseline.graphRevision !== state.graphRevision) {
      const pendingPatch = createGraphHistoryPatch(
        state.historyBaseline.nodes,
        state.historyBaseline.edges,
        state.nodes,
        state.edges,
      );
      if (hasGraphHistoryChanges(pendingPatch)) {
        historyState = appendPatch(
          historyState.historyStack,
          historyState.historyIndex,
          pendingPatch,
          limit,
        );
      }
    }

    const importPatch = createGraphHistoryPatch(
      state.nodes,
      state.edges,
      normalizedNodes,
      edges,
    );
    if (hasGraphHistoryChanges(importPatch)) {
      historyState = appendPatch(
        historyState.historyStack,
        historyState.historyIndex,
        importPatch,
        limit,
      );
    } else if (historyState.historyStack.length === 0) {
      historyState = {
        historyStack: [BASELINE_ENTRY],
        historyIndex: 0,
      };
    }

    set({
      ...historyState,
      historyBaseline: {
        nodes: normalizedNodes,
        edges,
        // importHistory 紧接着由 importer 调用一次 replace。
        graphRevision: state.graphRevision + 1,
      },
    });
  },

  clearHistory() {
    clearSaveTimeout();
    const state = get();
    set({
      historyStack: [],
      historyIndex: -1,
      historyBaseline: {
        nodes: state.nodes,
        edges: state.edges,
        graphRevision: state.graphRevision,
      },
    });
  },

  trimHistory(limit: number) {
    set((state) =>
      trimHistoryWindow(state.historyStack, state.historyIndex, limit),
    );
  },

  getHistoryState() {
    const state = get();
    return {
      canUndo: state.historyIndex > 0,
      canRedo: state.historyIndex < state.historyStack.length - 1,
    };
  },
});
