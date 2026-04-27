import { create } from "zustand";
import type { DebugModalPanel, DebugRunMode } from "../features/debug/types";

const STORAGE_KEY = "mpe_debug_modal_memory_v1";

interface DebugModalMemorySnapshot {
  lastPanel: DebugModalPanel;
  lastRunMode: DebugRunMode;
  lastEntryNodeId?: string;
}

interface DebugModalMemoryState extends DebugModalMemorySnapshot {
  setLastPanel: (panel: DebugModalPanel) => void;
  setLastRunMode: (runMode: DebugRunMode) => void;
  setLastEntryNodeId: (nodeId?: string) => void;
}

const defaultMemory: DebugModalMemorySnapshot = {
  lastPanel: "overview",
  lastRunMode: "full-run",
};

function readMemory(): DebugModalMemorySnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultMemory;
    const parsed = JSON.parse(raw) as Partial<DebugModalMemorySnapshot>;
    return {
      lastPanel: parsed.lastPanel ?? defaultMemory.lastPanel,
      lastRunMode: parsed.lastRunMode ?? defaultMemory.lastRunMode,
      lastEntryNodeId: parsed.lastEntryNodeId,
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
  }),
);
