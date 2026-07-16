import { create } from "zustand";
import { DEFAULT_DEBUG_PIPELINE_OVERRIDE_DRAFT } from "../features/debug/pipelineOverride";

const STORAGE_KEY = "mpe_debug_override_draft_v1";

interface DebugOverrideState {
  draft: string;
  setDraft: (draft: string) => void;
  resetDraft: () => void;
}

function readDraft(): string {
  try {
    const draft = localStorage.getItem(STORAGE_KEY);
    return draft ?? DEFAULT_DEBUG_PIPELINE_OVERRIDE_DRAFT;
  } catch (error) {
    console.warn("[debugOverrideStore] Failed to read draft:", error);
    return DEFAULT_DEBUG_PIPELINE_OVERRIDE_DRAFT;
  }
}

function writeDraft(draft: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, draft);
  } catch (error) {
    console.warn("[debugOverrideStore] Failed to write draft:", error);
  }
}

export const useDebugOverrideStore = create<DebugOverrideState>((set) => ({
  draft: readDraft(),
  setDraft: (draft) => {
    writeDraft(draft);
    set({ draft });
  },
  resetDraft: () => {
    writeDraft(DEFAULT_DEBUG_PIPELINE_OVERRIDE_DRAFT);
    set({ draft: DEFAULT_DEBUG_PIPELINE_OVERRIDE_DRAFT });
  },
}));
