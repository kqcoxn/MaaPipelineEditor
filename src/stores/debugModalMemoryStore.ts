import { create } from "zustand";
import type {
  DebugAutoOpenPanelOnRunFinish,
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
  autoCloseOnRunStart: boolean;
  autoOpenOnRunFinish: boolean;
  autoOpenPanelOnRunFinish: DebugAutoOpenPanelOnRunFinish;
  nodeExecutionFilters: DebugNodeExecutionFilters;
  nodeExecutionAttributionMode: DebugExecutionAttributionMode;
  nodeExecutionDetailMode: DebugExecutionDetailMode;
}

interface DebugModalMemoryState extends DebugModalMemorySnapshot {
  setLastPanel: (panel: DebugModalPanel) => void;
  setLastRunMode: (runMode: DebugRunMode) => void;
  setLastEntryNodeId: (nodeId?: string) => void;
  setAutoGenerateAiSummary: (enabled: boolean) => void;
  setAutoCloseOnRunStart: (enabled: boolean) => void;
  setAutoOpenOnRunFinish: (enabled: boolean) => void;
  setAutoOpenPanelOnRunFinish: (
    mode: DebugAutoOpenPanelOnRunFinish,
  ) => void;
  setNodeExecutionFilters: (filters: DebugNodeExecutionFilters) => void;
  setNodeExecutionAttributionMode: (
    mode: DebugExecutionAttributionMode,
  ) => void;
  setNodeExecutionDetailMode: (mode: DebugExecutionDetailMode) => void;
}

type PersistedDebugModalMemorySnapshot = DebugModalMemorySnapshot;

const defaultMemory: DebugModalMemorySnapshot = {
  lastPanel: "overview",
  lastRunMode: "run-from-node",
  autoGenerateAiSummary: false,
  autoCloseOnRunStart: true,
  autoOpenOnRunFinish: true,
  autoOpenPanelOnRunFinish: "last-closed",
  nodeExecutionFilters: DEFAULT_DEBUG_NODE_EXECUTION_FILTERS,
  nodeExecutionAttributionMode: "node",
  nodeExecutionDetailMode: "compact",
};

const validPanels = new Set<DebugModalPanel>([
  "overview",
  "ai-summary",
  "setup",
  "timeline",
  "node-execution",
  "performance",
  "images",
  "diagnostics",
]);
const panelAliases: Partial<Record<string, DebugModalPanel>> = {
  profile: "setup",
  resources: "setup",
  controller: "setup",
  agent: "setup",
  logs: "diagnostics",
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
const validAutoOpenPanels = new Set<DebugAutoOpenPanelOnRunFinish>([
  "last-closed",
  "overview",
  "node-execution",
]);
const validRunModes = new Set<DebugRunMode>([
  "run-from-node",
  "single-node-run",
  "recognition-only",
  "action-only",
  "replay",
]);

function normalizePanel(value: unknown): DebugModalPanel {
  if (validPanels.has(value as DebugModalPanel)) {
    return value as DebugModalPanel;
  }
  if (typeof value === "string" && panelAliases[value]) {
    return panelAliases[value]!;
  }
  return defaultMemory.lastPanel;
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

function normalizeAutoOpenPanelOnRunFinish(
  value: unknown,
): DebugAutoOpenPanelOnRunFinish {
  return validAutoOpenPanels.has(value as DebugAutoOpenPanelOnRunFinish)
    ? (value as DebugAutoOpenPanelOnRunFinish)
    : defaultMemory.autoOpenPanelOnRunFinish;
}

function readMemory(): DebugModalMemorySnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultMemory;
    const parsed = JSON.parse(raw) as Partial<PersistedDebugModalMemorySnapshot>;
    return {
      lastPanel: normalizePanel(parsed.lastPanel),
      lastRunMode: normalizeRunMode(parsed.lastRunMode),
      lastEntryNodeId: parsed.lastEntryNodeId,
      autoGenerateAiSummary: parsed.autoGenerateAiSummary === true,
      autoCloseOnRunStart:
        parsed.autoCloseOnRunStart !== undefined
          ? parsed.autoCloseOnRunStart === true
          : defaultMemory.autoCloseOnRunStart,
      autoOpenOnRunFinish:
        parsed.autoOpenOnRunFinish !== undefined
          ? parsed.autoOpenOnRunFinish === true
          : defaultMemory.autoOpenOnRunFinish,
      autoOpenPanelOnRunFinish: normalizeAutoOpenPanelOnRunFinish(
        parsed.autoOpenPanelOnRunFinish,
      ),
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

    setAutoGenerateAiSummary: (autoGenerateAiSummary) => {
      const next = { ...get(), autoGenerateAiSummary };
      writeMemory(next);
      set({ autoGenerateAiSummary });
    },

    setAutoCloseOnRunStart: (autoCloseOnRunStart) => {
      const next = { ...get(), autoCloseOnRunStart };
      writeMemory(next);
      set({ autoCloseOnRunStart });
    },

    setAutoOpenOnRunFinish: (autoOpenOnRunFinish) => {
      const next = { ...get(), autoOpenOnRunFinish };
      writeMemory(next);
      set({ autoOpenOnRunFinish });
    },

    setAutoOpenPanelOnRunFinish: (autoOpenPanelOnRunFinish) => {
      const next = { ...get(), autoOpenPanelOnRunFinish };
      writeMemory(next);
      set({ autoOpenPanelOnRunFinish });
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
