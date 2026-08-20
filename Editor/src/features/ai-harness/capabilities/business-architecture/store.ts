import { create } from "zustand";
import type { BusinessArchitectureDocument } from "./types";

interface BusinessArchitectureState {
  documents: Record<string, BusinessArchitectureDocument>;
  activeDocumentRunId: string | null;
  setDocument: (document: BusinessArchitectureDocument) => void;
  openDocument: (runId: string) => boolean;
  closeDocument: () => void;
  clear: (runId?: string) => void;
}

export const useBusinessArchitectureStore =
  create<BusinessArchitectureState>()((set) => ({
    documents: {},
    activeDocumentRunId: null,
    setDocument: (document) =>
      set((state) => ({
        documents: {
          ...state.documents,
          [document.sourceRunId]: document,
        },
      })),
    openDocument: (runId) => {
      let opened = false;
      set((state) => {
        if (!state.documents[runId]) return {};
        opened = true;
        return { activeDocumentRunId: runId };
      });
      return opened;
    },
    closeDocument: () => set({ activeDocumentRunId: null }),
    clear: (runId) =>
      set((state) => {
        if (!runId) {
          return { documents: {}, activeDocumentRunId: null };
        }
        const documents = { ...state.documents };
        delete documents[runId];
        return {
          documents,
          activeDocumentRunId:
            state.activeDocumentRunId === runId
              ? null
              : state.activeDocumentRunId,
        };
      }),
  }));
