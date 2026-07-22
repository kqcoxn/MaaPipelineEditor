import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import type {
  ArtifactRef,
  DocumentMapping,
  DocumentOpenResult,
  WorkspaceDocument,
} from "../services/generated/bridge-v2";
import { asDocumentId, type DocumentId } from "../features/project-session/types";

export interface DocumentConflict {
  externalContent: string;
  externalRevision: string;
}

export interface OpenDocument {
  documentId: DocumentId;
  path: string;
  descriptor: WorkspaceDocument;
  content: string;
  savedContent: string;
  baseRevision: string;
  dirty: boolean;
  loading: boolean;
  error?: string;
  conflict?: DocumentConflict;
  artifact?: ArtifactRef;
  imageUrl?: string;
  deleted?: boolean;
}

interface DocumentState {
  opened: Record<DocumentId, OpenDocument>;
}

interface DocumentActions {
  beginOpen: (documentId: DocumentId, descriptor: WorkspaceDocument) => boolean;
  finishOpen: (
    documentId: DocumentId,
    result: DocumentOpenResult,
    imageUrl?: string,
  ) => void;
  failOpen: (documentId: DocumentId, error: string) => void;
  updateContent: (documentId: DocumentId, content: string) => void;
  markSaved: (
    documentId: DocumentId,
    revision: string,
    savedContent: string,
  ) => void;
  setConflict: (documentId: DocumentId, external: DocumentOpenResult) => void;
  keepLocal: (documentId: DocumentId) => void;
  reloadExternal: (
    documentId: DocumentId,
    external: DocumentOpenResult,
    imageUrl?: string,
  ) => void;
  markDeleted: (documentId: DocumentId) => void;
  applyDocumentMappings: (mappings: DocumentMapping[]) => void;
  closeDocument: (documentId: DocumentId) => void;
  clearProject: () => void;
}

export type DocumentStore = DocumentState & DocumentActions;

export const useDocumentStore = create<DocumentStore>()(
  subscribeWithSelector((set) => ({
    opened: {},
    beginOpen(documentId, descriptor) {
      if (descriptor.kind === "pipeline") return false;
      set((state) => {
        const existing = state.opened[documentId];
        return {
          opened: {
            ...state.opened,
            [documentId]: {
              documentId,
              path: descriptor.path,
              descriptor,
              content: existing?.content ?? "",
              savedContent: existing?.savedContent ?? "",
              baseRevision: existing?.baseRevision ?? "",
              dirty: existing?.dirty ?? false,
              loading: true,
              conflict: existing?.conflict,
              artifact: existing?.artifact,
              imageUrl: existing?.imageUrl,
            },
          },
        };
      });
      return true;
    },
    finishOpen(documentId, result, imageUrl) {
      const descriptor = descriptorFromOpenResult(result);
      const content = result.content ?? "";
      set((state) => ({
        opened: {
          ...state.opened,
          [documentId]: {
            documentId,
            path: result.path,
            descriptor,
            content,
            savedContent: content,
            baseRevision: result.revision,
            dirty: false,
            loading: false,
            artifact: result.artifact,
            imageUrl,
          },
        },
      }));
    },
    failOpen(documentId, error) {
      updateOpened(set, documentId, (document) => ({
        ...document,
        loading: false,
        error,
      }));
    },
    updateContent(documentId, content) {
      updateOpened(set, documentId, (document) =>
        document.descriptor.editable
          ? { ...document, content, dirty: content !== document.savedContent }
          : document,
      );
    },
    markSaved(documentId, revision, savedContent) {
      updateOpened(set, documentId, (document) => ({
        ...document,
        savedContent,
        baseRevision: revision,
        dirty: document.content !== savedContent,
        conflict: undefined,
        error: undefined,
      }));
    },
    setConflict(documentId, external) {
      updateOpened(set, documentId, (document) => ({
        ...document,
        descriptor: descriptorFromOpenResult(external),
        conflict: {
          externalContent: external.content ?? "",
          externalRevision: external.revision,
        },
        loading: false,
      }));
    },
    keepLocal(documentId) {
      updateOpened(set, documentId, (document) =>
        document.conflict
          ? {
              ...document,
              savedContent: document.conflict.externalContent,
              baseRevision: document.conflict.externalRevision,
              dirty: document.content !== document.conflict.externalContent,
              conflict: undefined,
            }
          : document,
      );
    },
    reloadExternal(documentId, external, imageUrl) {
      const descriptor = descriptorFromOpenResult(external);
      const content = external.content ?? "";
      set((state) => ({
        opened: {
          ...state.opened,
          [documentId]: {
            documentId,
            path: external.path,
            descriptor,
            content,
            savedContent: content,
            baseRevision: external.revision,
            dirty: false,
            loading: false,
            artifact: external.artifact,
            imageUrl,
          },
        },
      }));
    },
    markDeleted(documentId) {
      updateOpened(set, documentId, (document) => ({ ...document, deleted: true }));
    },
    applyDocumentMappings(mappings) {
      set((state) => {
        const opened = { ...state.opened };
        mappings.forEach((mapping) => {
          const oldId = asDocumentId(mapping.oldDocumentId);
          const document = opened[oldId];
          if (!document) return;
          const newId = asDocumentId(mapping.newDocumentId);
          delete opened[oldId];
          opened[newId] = {
            ...document,
            documentId: newId,
            path: mapping.newPath,
            descriptor: {
              ...document.descriptor,
              path: mapping.newPath,
              name: mapping.newPath.split("/").at(-1) ?? document.descriptor.name,
            },
          };
        });
        return { opened };
      });
    },
    closeDocument(documentId) {
      set((state) => {
        const opened = { ...state.opened };
        delete opened[documentId];
        return { opened };
      });
    },
    clearProject() {
      set({ opened: {} });
    },
  })),
);

function updateOpened(
  set: (
    updater: (state: DocumentStore) => Partial<DocumentStore> | DocumentStore,
  ) => void,
  documentId: DocumentId,
  update: (document: OpenDocument) => OpenDocument,
): void {
  set((state) => {
    const document = state.opened[documentId];
    if (!document) return state;
    return { opened: { ...state.opened, [documentId]: update(document) } };
  });
}

export function getDirtyDocumentIds(): DocumentId[] {
  return Object.values(useDocumentStore.getState().opened)
    .filter((document) => document.dirty)
    .map((document) => document.documentId);
}

function descriptorFromOpenResult(result: DocumentOpenResult): WorkspaceDocument {
  return {
    path: result.path,
    name: result.name,
    kind: result.kind,
    language: result.language,
    mimeType: result.mimeType,
    size: result.size,
    editable: result.editable,
    previewable: result.previewable,
    readOnlyReason: result.readOnlyReason,
    role: result.role,
  };
}
