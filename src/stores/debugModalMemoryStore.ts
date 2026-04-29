import { create } from "zustand";
import type {
  DebugNodeExecutionArtifactFilter,
  DebugNodeExecutionEventKindFilter,
  DebugModalPanel,
  DebugNodeExecutionFilters,
  DebugNodeExecutionStatusFilter,
  DebugNodeExecutionSortMode,
  DebugRunMode,
} from "../features/debug/types";
import { DEFAULT_DEBUG_NODE_EXECUTION_FILTERS } from "../features/debug/types";

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
  nodeExecutionFilters: DEFAULT_DEBUG_NODE_EXECUTION_FILTERS,
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
const validNodeExecutionEventKindFilters =
  new Set<DebugNodeExecutionEventKindFilter>([
    "all",
    "session",
    "task",
    "node",
    "next-list",
    "recognition",
    "action",
    "wait-freezes",
    "screenshot",
    "diagnostic",
    "artifact",
    "log",
  ]);
const validNodeExecutionArtifactFilters =
  new Set<DebugNodeExecutionArtifactFilter>([
    "all",
    "with-artifact",
    "without-artifact",
  ]);
const validNodeExecutionSortModes = new Set<DebugNodeExecutionSortMode>([
  "execution",
  "failure-first",
  "slow-first",
  "latest",
]);

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
    runId:
      typeof raw.runId === "string" && raw.runId.trim() !== ""
        ? raw.runId
        : undefined,
    status: validNodeExecutionStatusFilters.has(
      raw.status as DebugNodeExecutionStatusFilter,
    )
      ? (raw.status as DebugNodeExecutionStatusFilter)
      : defaultMemory.nodeExecutionFilters.status,
    eventKind: validNodeExecutionEventKindFilters.has(
      raw.eventKind as DebugNodeExecutionEventKindFilter,
    )
      ? (raw.eventKind as DebugNodeExecutionEventKindFilter)
      : defaultMemory.nodeExecutionFilters.eventKind,
    artifact: validNodeExecutionArtifactFilters.has(
      raw.artifact as DebugNodeExecutionArtifactFilter,
    )
      ? (raw.artifact as DebugNodeExecutionArtifactFilter)
      : defaultMemory.nodeExecutionFilters.artifact,
    failedOnly: raw.failedOnly === true,
    sortMode: validNodeExecutionSortModes.has(
      raw.sortMode as DebugNodeExecutionSortMode,
    )
      ? (raw.sortMode as DebugNodeExecutionSortMode)
      : defaultMemory.nodeExecutionFilters.sortMode,
    groupRepeated: raw.groupRepeated === true,
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
