import { create } from "zustand";

const STORAGE_KEY = "mpe_wiki_ui_memory_v1";

interface WikiUiMemorySnapshot {
  dismissedEmptyCanvasHint: boolean;
  shownMigrationHintFilePaths: string[];
}

interface WikiUiMemoryState extends WikiUiMemorySnapshot {
  activeMigrationHintFilePath?: string;
  dismissEmptyCanvasHint: () => void;
  requestMigrationHint: (filePath: string) => void;
  clearActiveMigrationHint: () => void;
}

function normalizeFilePaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function readMemory(): WikiUiMemorySnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        dismissedEmptyCanvasHint: false,
        shownMigrationHintFilePaths: [],
      };
    }

    const parsed = JSON.parse(raw) as Partial<WikiUiMemorySnapshot>;
    return {
      dismissedEmptyCanvasHint: parsed.dismissedEmptyCanvasHint === true,
      shownMigrationHintFilePaths: normalizeFilePaths(
        parsed.shownMigrationHintFilePaths,
      ),
    };
  } catch (error) {
    console.warn("[wikiUiMemoryStore] Failed to read memory:", error);
    return {
      dismissedEmptyCanvasHint: false,
      shownMigrationHintFilePaths: [],
    };
  }
}

function writeMemory(snapshot: WikiUiMemorySnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("[wikiUiMemoryStore] Failed to write memory:", error);
  }
}

export const useWikiUiMemoryStore = create<WikiUiMemoryState>((set, get) => ({
  ...readMemory(),
  activeMigrationHintFilePath: undefined,

  dismissEmptyCanvasHint: () => {
    const next = {
      dismissedEmptyCanvasHint: true,
      shownMigrationHintFilePaths: get().shownMigrationHintFilePaths,
    };
    writeMemory(next);
    set(next);
  },

  requestMigrationHint: (filePath) => {
    const normalizedPath = filePath.trim();
    if (!normalizedPath) return;

    const state = get();
    if (state.shownMigrationHintFilePaths.includes(normalizedPath)) {
      set({ activeMigrationHintFilePath: undefined });
      return;
    }

    const shownMigrationHintFilePaths = [
      ...state.shownMigrationHintFilePaths,
      normalizedPath,
    ];
    writeMemory({
      dismissedEmptyCanvasHint: state.dismissedEmptyCanvasHint,
      shownMigrationHintFilePaths,
    });
    set({
      shownMigrationHintFilePaths,
      activeMigrationHintFilePath: normalizedPath,
    });
  },

  clearActiveMigrationHint: () => {
    set({ activeMigrationHintFilePath: undefined });
  },
}));
