import { create } from "zustand";
import type {
  DebugExecutionAttributionMode,
  DebugExecutionDetailMode,
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
  autoGenerateAiSummary: boolean;
  nodeExecutionFilters: DebugNodeExecutionFilters;
  nodeExecutionAttributionMode: DebugExecutionAttributionMode;
  nodeExecutionDetailMode: DebugExecutionDetailMode;
}

interface DebugModalMemoryState extends DebugModalMemorySnapshot {
  setLastPanel: (panel: DebugModalPanel) => void;
  setLastRunMode: (runMode: DebugRunMode) => void;
  setLastEntryNodeId: (nodeId?: string) => void;
  setAutoGenerateAiSummary: (enabled: boolean) => void;
  setNodeExecutionFilters: (filters: DebugNodeExecutionFilters) => void;
  setNodeExecutionAttributionMode: (
    mode: DebugExecutionAttributionMode,
  ) => void;
  setNodeExecutionDetailMode: (mode: DebugExecutionDetailMode) => void;
}

type PersistedDebugModalMemorySnapshot = Omit<
  DebugModalMemorySnapshot,
  "lastPanel"
>;

const defaultMemory: DebugModalMemorySnapshot = {
  lastPanel: "overview",
  lastRunMode: "run-from-node",
  autoGenerateAiSummary: false,
  nodeExecutionFilters: DEFAULT_DEBUG_NODE_EXECUTION_FILTERS,
  nodeExecutionAttributionMode: "node",
  nodeExecutionDetailMode: "compact",
};

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
  "latest",
]);
const validNodeExecutionAttributionModes =
  new Set<DebugExecutionAttributionMode>(["next", "node"]);
const validNodeExecutionDetailModes = new Set<DebugExecutionDetailMode>([
  "compact",
  "detailed",
]);
const validRunModes = new Set<DebugRunMode>([
  "run-from-node",
  "single-node-run",
  "recognition-only",
  "action-only",
  "replay",
]);

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
    sortMode: validNodeExecutionSortModes.has(
      raw.sortMode as DebugNodeExecutionSortMode,
    )
      ? (raw.sortMode as DebugNodeExecutionSortMode)
      : defaultMemory.nodeExecutionFilters.sortMode,
    groupRepeated: raw.groupRepeated === true,
  };
}

function normalizeNodeExecutionAttributionMode(
  value: unknown,
): DebugExecutionAttributionMode {
  return validNodeExecutionAttributionModes.has(
    value as DebugExecutionAttributionMode,
  )
    ? (value as DebugExecutionAttributionMode)
    : defaultMemory.nodeExecutionAttributionMode;
}

function normalizeNodeExecutionDetailMode(
  value: unknown,
): DebugExecutionDetailMode {
  return validNodeExecutionDetailModes.has(value as DebugExecutionDetailMode)
    ? (value as DebugExecutionDetailMode)
    : defaultMemory.nodeExecutionDetailMode;
}

function normalizeRunMode(value: unknown): DebugRunMode {
  return validRunModes.has(value as DebugRunMode)
    ? (value as DebugRunMode)
    : defaultMemory.lastRunMode;
}

function readMemory(): DebugModalMemorySnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultMemory;
    const parsed = JSON.parse(raw) as Partial<PersistedDebugModalMemorySnapshot>;
    return {
      lastPanel: defaultMemory.lastPanel,
      lastRunMode: normalizeRunMode(parsed.lastRunMode),
      lastEntryNodeId: parsed.lastEntryNodeId,
      autoGenerateAiSummary: parsed.autoGenerateAiSummary === true,
      nodeExecutionFilters: normalizeNodeExecutionFilters(
        parsed.nodeExecutionFilters,
      ),
      nodeExecutionAttributionMode: normalizeNodeExecutionAttributionMode(
        parsed.nodeExecutionAttributionMode,
      ),
      nodeExecutionDetailMode: normalizeNodeExecutionDetailMode(
        parsed.nodeExecutionDetailMode,
      ),
    };
  } catch (error) {
    console.warn("[debugModalMemoryStore] Failed to read memory:", error);
    return defaultMemory;
  }
}

function writeMemory(snapshot: DebugModalMemorySnapshot): void {
  try {
    const persisted: PersistedDebugModalMemorySnapshot = {
      lastRunMode: snapshot.lastRunMode,
      lastEntryNodeId: snapshot.lastEntryNodeId,
      autoGenerateAiSummary: snapshot.autoGenerateAiSummary,
      nodeExecutionFilters: snapshot.nodeExecutionFilters,
      nodeExecutionAttributionMode: snapshot.nodeExecutionAttributionMode,
      nodeExecutionDetailMode: snapshot.nodeExecutionDetailMode,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch (error) {
    console.warn("[debugModalMemoryStore] Failed to write memory:", error);
  }
}

export const useDebugModalMemoryStore = create<DebugModalMemoryState>(
  (set, get) => ({
    ...readMemory(),

    setLastPanel: (panel) => {
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

    setAutoGenerateAiSummary: (autoGenerateAiSummary) => {
      const next = { ...get(), autoGenerateAiSummary };
      writeMemory(next);
      set({ autoGenerateAiSummary });
    },

    setNodeExecutionFilters: (nodeExecutionFilters) => {
      const next = { ...get(), nodeExecutionFilters };
      writeMemory(next);
      set({ nodeExecutionFilters });
    },

    setNodeExecutionAttributionMode: (nodeExecutionAttributionMode) => {
      const next = { ...get(), nodeExecutionAttributionMode };
      writeMemory(next);
      set({ nodeExecutionAttributionMode });
    },

    setNodeExecutionDetailMode: (nodeExecutionDetailMode) => {
      const next = { ...get(), nodeExecutionDetailMode };
      writeMemory(next);
      set({ nodeExecutionDetailMode });
    },
  }),
);
