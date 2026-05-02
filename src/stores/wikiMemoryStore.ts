import { create } from "zustand";
import type { WikiTarget } from "../wiki/types";

const STORAGE_KEY = "mpe_wiki_reader_memory_v1";

interface WikiMemorySnapshot {
  lastTarget?: WikiTarget;
}

interface WikiMemoryState extends WikiMemorySnapshot {
  setLastTarget: (target?: WikiTarget) => void;
}

function isWikiTarget(value: unknown): value is WikiTarget {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const target = value as Partial<WikiTarget>;
  return (
    typeof target.entryId === "string" &&
    (target.moduleId === undefined || typeof target.moduleId === "string") &&
    (target.stepId === undefined || typeof target.stepId === "string")
  );
}

function readMemory(): WikiMemorySnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<WikiMemorySnapshot>;
    return {
      lastTarget: isWikiTarget(parsed.lastTarget) ? parsed.lastTarget : undefined,
    };
  } catch (error) {
    console.warn("[wikiMemoryStore] Failed to read memory:", error);
    return {};
  }
}

function writeMemory(snapshot: WikiMemorySnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("[wikiMemoryStore] Failed to write memory:", error);
  }
}

export const useWikiMemoryStore = create<WikiMemoryState>((set) => ({
  ...readMemory(),

  setLastTarget: (lastTarget) => {
    const next = { lastTarget };
    writeMemory(next);
    set(next);
  },
}));
