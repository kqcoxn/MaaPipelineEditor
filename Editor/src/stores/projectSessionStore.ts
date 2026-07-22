import { arrayMove } from "@dnd-kit/sortable";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import type {
  DocumentMapping,
  ProjectEntriesPayload,
} from "../services/generated/bridge-v2";
import { parseProjectPath } from "../features/project-session/projectPath";
import {
  asDocumentId,
  asProjectId,
  asProjectSessionId,
  type DocumentId,
  type DraftEntry,
  type EditorDocumentEntry,
  type ProjectAvailability,
  type ProjectEntry,
  type ProjectIdentity,
  type ProjectStorageAdapterKind,
  type ProjectStorageCapabilities,
} from "../features/project-session/types";

export interface EditorTab {
  documentId: DocumentId;
}

interface ProjectSessionState {
  sessionId: ReturnType<typeof asProjectSessionId> | null;
  identity: ProjectIdentity | null;
  adapterKind: ProjectStorageAdapterKind | null;
  availability: ProjectAvailability;
  connected: boolean;
  capabilities: ProjectStorageCapabilities | null;
  entriesRevision: number;
  entriesByPath: Record<string, ProjectEntry>;
  entriesById: Record<DocumentId, EditorDocumentEntry>;
  documentIdByPath: Record<string, DocumentId>;
  tabs: EditorTab[];
  activeDocumentId: DocumentId | null;
}

interface ProjectSessionActions {
  establishSession: (
    identity: ProjectIdentity,
    adapterKind: ProjectStorageAdapterKind,
  ) => void;
  setAvailability: (
    availability: ProjectAvailability,
    connected?: boolean,
  ) => void;
  setCapabilities: (capabilities: ProjectStorageCapabilities | null) => void;
  applyEntries: (payload: ProjectEntriesPayload) => void;
  applyDocumentMappings: (mappings: DocumentMapping[]) => void;
  registerDraft: (
    name: string,
    kind?: DraftEntry["kind"],
    documentId?: DocumentId,
  ) => DocumentId;
  openDocument: (documentId: DocumentId) => DocumentId | null;
  activateTab: (documentId: DocumentId) => boolean;
  closeTab: (documentId: DocumentId) => DocumentId | null;
  reorderTab: (activeId: DocumentId, overId: DocumentId) => void;
  prepareReconnect: () => void;
  clearProject: () => void;
  clear: () => void;
}

export type ProjectSessionStore = ProjectSessionState & ProjectSessionActions;

const initialState: ProjectSessionState = {
  sessionId: null,
  identity: null,
  adapterKind: null,
  availability: "unavailable",
  connected: false,
  capabilities: null,
  entriesRevision: 0,
  entriesByPath: {},
  entriesById: {},
  documentIdByPath: {},
  tabs: [],
  activeDocumentId: null,
};

export const useProjectSessionStore = create<ProjectSessionStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,
    establishSession(identity, adapterKind) {
      set((state) => {
        const sameProject = state.identity?.projectId === identity.projectId;
        const drafts = draftEntries(state.entriesById);
        const tabs = sameProject
          ? state.tabs
          : state.tabs.filter((tab) => drafts[tab.documentId]);
        return {
          sessionId: sameProject
            ? state.sessionId
            : asProjectSessionId(crypto.randomUUID()),
          identity,
          adapterKind,
          availability: "ready",
          connected: true,
          capabilities: sameProject ? state.capabilities : null,
          entriesRevision: sameProject ? state.entriesRevision : 0,
          entriesByPath: sameProject ? state.entriesByPath : {},
          entriesById: sameProject ? state.entriesById : drafts,
          documentIdByPath: sameProject ? state.documentIdByPath : {},
          tabs,
          activeDocumentId: tabs.some(
            (tab) => tab.documentId === state.activeDocumentId,
          )
            ? state.activeDocumentId
            : (tabs.at(-1)?.documentId ?? null),
        };
      });
    },
    setAvailability(availability, connected = availability === "ready") {
      set({ availability, connected });
    },
    setCapabilities(capabilities) {
      set({ capabilities });
    },
    applyEntries(payload) {
      const state = get();
      if (
        !payload.projectId ||
        state.identity?.projectId !== asProjectId(payload.projectId) ||
        payload.revision < state.entriesRevision
      ) {
        return;
      }
      const entriesById = draftEntries(state.entriesById);
      const entriesByPath: ProjectSessionState["entriesByPath"] = {};
      const documentIdByPath: Record<string, DocumentId> = {};
      payload.entries.forEach((value) => {
        const path = parseProjectPath(value.path);
        const documentId = value.documentId
          ? asDocumentId(value.documentId)
          : undefined;
        const entry = { ...value, path, documentId };
        entriesByPath[path] = entry;
        if (documentId) {
          entriesById[documentId] = entry;
          documentIdByPath[path] = documentId;
        }
      });
      set({
        entriesRevision: payload.revision,
        entriesByPath,
        entriesById,
        documentIdByPath,
      });
    },
    applyDocumentMappings(mappings) {
      if (!mappings.length) return;
      set((state) => {
        const entriesById = { ...state.entriesById };
        const entriesByPath = { ...state.entriesByPath };
        const documentIdByPath = { ...state.documentIdByPath };
        const idMappings = new Map<DocumentId, DocumentId>();
        mappings.forEach((mapping) => {
          const oldId = asDocumentId(mapping.oldDocumentId);
          const newId = asDocumentId(mapping.newDocumentId);
          const entry = entriesById[oldId];
          delete entriesById[oldId];
          delete documentIdByPath[mapping.oldPath];
          const pathEntry = entriesByPath[mapping.oldPath];
          delete entriesByPath[mapping.oldPath];
          if (entry && "path" in entry) {
            const path = parseProjectPath(mapping.newPath);
            entriesById[newId] = {
              ...entry,
              documentId: newId,
              path,
              name: path.split("/").at(-1) ?? entry.name,
            };
            documentIdByPath[path] = newId;
            entriesByPath[path] = entriesById[newId];
          } else if (pathEntry) {
            const path = parseProjectPath(mapping.newPath);
            entriesByPath[path] = {
              ...pathEntry,
              path,
              name: path.split("/").at(-1) ?? pathEntry.name,
            };
          }
          idMappings.set(oldId, newId);
        });
        return {
          entriesById,
          entriesByPath,
          documentIdByPath,
          tabs: state.tabs.map((tab) => ({
            documentId: idMappings.get(tab.documentId) ?? tab.documentId,
          })),
          activeDocumentId: state.activeDocumentId
            ? (idMappings.get(state.activeDocumentId) ?? state.activeDocumentId)
            : null,
        };
      });
    },
    registerDraft(name, kind = "pipeline", documentId) {
      const id = documentId ?? asDocumentId(`draft:${crypto.randomUUID()}`);
      set((state) => ({
        entriesById: {
          ...state.entriesById,
          [id]: { documentId: id, entryKind: "file", kind, name },
        },
      }));
      return id;
    },
    openDocument(documentId) {
      if (!get().entriesById[documentId]) return null;
      set((state) => ({
        tabs: state.tabs.some((tab) => tab.documentId === documentId)
          ? state.tabs
          : [...state.tabs, { documentId }],
        activeDocumentId: documentId,
      }));
      return documentId;
    },
    activateTab(documentId) {
      if (!get().tabs.some((tab) => tab.documentId === documentId)) return false;
      set({ activeDocumentId: documentId });
      return true;
    },
    closeTab(documentId) {
      const { tabs, activeDocumentId } = get();
      const index = tabs.findIndex((tab) => tab.documentId === documentId);
      if (index < 0) return activeDocumentId;
      const nextTabs = tabs.filter((tab) => tab.documentId !== documentId);
      const nextActiveId =
        activeDocumentId === documentId
          ? (nextTabs[Math.min(index, nextTabs.length - 1)]?.documentId ?? null)
          : activeDocumentId;
      set({ tabs: nextTabs, activeDocumentId: nextActiveId });
      return nextActiveId;
    },
    reorderTab(activeId, overId) {
      set((state) => {
        const activeIndex = state.tabs.findIndex(
          (tab) => tab.documentId === activeId,
        );
        const overIndex = state.tabs.findIndex(
          (tab) => tab.documentId === overId,
        );
        if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
          return state;
        }
        return { tabs: arrayMove(state.tabs, activeIndex, overIndex) };
      });
    },
    prepareReconnect() {
      set({ availability: "connecting", connected: false, entriesRevision: 0 });
    },
    clearProject() {
      set((state) => {
        const entriesById = draftEntries(state.entriesById);
        const tabs = state.tabs.filter((tab) => entriesById[tab.documentId]);
        return {
          ...initialState,
          entriesById,
          entriesByPath: {},
          tabs,
          activeDocumentId: tabs.at(-1)?.documentId ?? null,
        };
      });
    },
    clear() {
      set(initialState);
    },
  })),
);

function draftEntries(
  entries: Record<DocumentId, EditorDocumentEntry>,
): Record<DocumentId, EditorDocumentEntry> {
  return Object.fromEntries(
    Object.entries(entries).filter(([documentId]) =>
      documentId.startsWith("draft:"),
    ),
  ) as Record<DocumentId, EditorDocumentEntry>;
}

export function getEntryByDocumentId(
  documentId: DocumentId | null | undefined,
): EditorDocumentEntry | undefined {
  return documentId
    ? useProjectSessionStore.getState().entriesById[documentId]
    : undefined;
}

export function getDocumentIdByPath(path: string): DocumentId | undefined {
  return useProjectSessionStore.getState().documentIdByPath[path];
}
