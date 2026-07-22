import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { Viewport } from "@xyflow/react";

import type { DocumentId } from "../project-session/types";
import type { PipelineDocumentState, PipelineViewMode } from "./types";

interface PipelineDocumentStoreState {
  documents: Record<DocumentId, PipelineDocumentState>;
}

interface PipelineDocumentStoreActions {
  ensureDocument: (documentId: DocumentId) => PipelineDocumentState;
  updateDocument: (
    documentId: DocumentId,
    update: (state: PipelineDocumentState) => PipelineDocumentState,
  ) => void;
  setViewMode: (documentId: DocumentId, viewMode: PipelineViewMode) => void;
  setViewport: (documentId: DocumentId, viewport: Viewport) => void;
  removeDocument: (documentId: DocumentId) => void;
  clear: () => void;
}

export type PipelineDocumentStore = PipelineDocumentStoreState &
  PipelineDocumentStoreActions;

function initialDocumentState(): PipelineDocumentState {
  return {
    viewMode: "flow",
    parseState: "invalid",
    projectionStatus: "unavailable",
    parsedWorkingRevision: -1,
  };
}

export const usePipelineDocumentStore = create<PipelineDocumentStore>()(
  subscribeWithSelector((set, get) => ({
    documents: {},
    ensureDocument(documentId) {
      const existing = get().documents[documentId];
      if (existing) return existing;
      const created = initialDocumentState();
      set((state) => ({
        documents: { ...state.documents, [documentId]: created },
      }));
      return created;
    },
    updateDocument(documentId, update) {
      set((state) => {
        const current = state.documents[documentId] ?? initialDocumentState();
        return {
          documents: {
            ...state.documents,
            [documentId]: update(current),
          },
        };
      });
    },
    setViewMode(documentId, viewMode) {
      get().updateDocument(documentId, (document) => ({ ...document, viewMode }));
    },
    setViewport(documentId, viewport) {
      get().updateDocument(documentId, (document) => ({
        ...document,
        viewport: { ...viewport },
      }));
    },
    removeDocument(documentId) {
      set((state) => {
        if (!state.documents[documentId]) return state;
        const documents = { ...state.documents };
        delete documents[documentId];
        return { documents };
      });
    },
    clear() {
      set({ documents: {} });
    },
  })),
);
