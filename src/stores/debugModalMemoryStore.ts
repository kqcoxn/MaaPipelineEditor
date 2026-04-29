import { create } from "zustand";
import type {
  DebugModalPanel,
  DebugNodeExecutionFilters,
  DebugNodeExecutionStatusFilter,
  DebugRunMode,
} from "../features/debug/types";

const STORAGE_KEY = "mpe_debug_modal_memory_v1";

interface DebugModalMemorySnapshot {
  lastPanel: DebugModalPanel;
  lastRunMode: DebugRunMode;
  lastEntryNodeId?: string;
  nodeExecutionFilters: DebugNodeExecutionFilters;
}

interface DebugModalMemoryState extends DebugModalMemorySnapshot {
  setLastPanel: (panel: DebugModalPanel) => void;
  setLastRunMode: (runMode: DebugRunMode) => void;
  setLastEntryNodeId: (nodeId?: string) => void;
  setNodeExecutionFilters: (filters: DebugNodeExecutionFilters) => void;
}

const defaultMemory: DebugModalMemorySnapshot = {
  lastPanel: "overview",
  lastRunMode: "full-run",
  nodeExecutionFilters: {
    status: "all",
  },
};

const validPanels = new Set<DebugModalPanel>([
  "overview",
  "setup",
  "timeline",
  "node-execution",
  "performance",
  "images",
  "diagnostics",
  "logs",
]);

const validNodeExecutionStatusFilters = new Set<DebugNodeExecutionStatusFilter>(
  ["all", "running", "succeeded", "failed", "visited"],
);

function normalizePanel(panel: unknown): DebugModalPanel {
  if (
    panel === "profile" ||
    panel === "resources" ||
    panel === "controller" ||
    panel === "agent"
  ) {
    return "setup";
  }
  if (panel === "nodes") {
    return "node-execution";
  }
  return typeof panel === "string" && validPanels.has(panel as DebugModalPanel)
    ? (panel as DebugModalPanel)
    : defaultMemory.lastPanel;
}

function normalizeNodeExecutionFilters(
  value: unknown,
): DebugNodeExecutionFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultMemory.nodeExecutionFilters;
  }
  const raw = value as Partial<DebugNodeExecutionFilters>;
  return {
    nodeId:
      typeof raw.nodeId === "string" && raw.nodeId.trim() !== ""
        ? raw.nodeId
        : undefined,
    status: validNodeExecutionStatusFilters.has(
      raw.status as DebugNodeExecutionStatusFilter,
    )
      ? (raw.status as DebugNodeExecutionStatusFilter)
      : defaultMemory.nodeExecutionFilters.status,
  };
}

function readMemory(): DebugModalMemorySnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultMemory;
    const parsed = JSON.parse(raw) as Partial<DebugModalMemorySnapshot>;
    return {
      lastPanel: normalizePanel(parsed.lastPanel),
      lastRunMode: parsed.lastRunMode ?? defaultMemory.lastRunMode,
      lastEntryNodeId: parsed.lastEntryNodeId,
      nodeExecutionFilters: normalizeNodeExecutionFilters(
        parsed.nodeExecutionFilters,
      ),
    };
  } catch (error) {
    console.warn("[debugModalMemoryStore] Failed to read memory:", error);
    return defaultMemory;
  }
}

function writeMemory(snapshot: DebugModalMemorySnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("[debugModalMemoryStore] Failed to write memory:", error);
  }
}

export const useDebugModalMemoryStore = create<DebugModalMemoryState>(
  (set, get) => ({
    ...readMemory(),

    setLastPanel: (panel) => {
      const next = { ...get(), lastPanel: panel };
      writeMemory(next);
      set({ lastPanel: panel });
    },

    setLastRunMode: (runMode) => {
      const next = { ...get(), lastRunMode: runMode };
      writeMemory(next);
      set({ lastRunMode: runMode });
    },

    setLastEntryNodeId: (nodeId) => {
      const next = { ...get(), lastEntryNodeId: nodeId };
      writeMemory(next);
      set({ lastEntryNodeId: nodeId });
    },

    setNodeExecutionFilters: (nodeExecutionFilters) => {
      const next = { ...get(), nodeExecutionFilters };
      writeMemory(next);
      set({ nodeExecutionFilters });
    },
  }),
);
