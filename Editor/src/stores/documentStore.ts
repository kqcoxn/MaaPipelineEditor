import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import type {
  ArtifactRef,
  DocumentMapping,
  DocumentOpenResult,
  DocumentSaveResult,
  WorkspaceDocument,
} from "../services/generated/bridge-v2";
import { asDocumentId, type DocumentId } from "../features/project-session/types";
import type { DocumentEncoding } from "../features/project-storage/ProjectStorageAdapter";

export interface DocumentConflict {
  externalText: string;
  externalRevision: string;
  externalEncoding: DocumentEncoding;
}

export type PipelineSupportLevel =
  | "full"
  | "preserved"
  | "graph-unsupported"
  | "unparseable";

export interface DocumentDiagnostic {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  offset: number;
  length: number;
  path: Array<string | number>;
  supportLevel: PipelineSupportLevel;
}

export interface OpenDocument {
  documentId: DocumentId;
  path: string;
  descriptor: WorkspaceDocument;
  savedText: string;
  workingText: string;
  savedRevision: string;
  workingRevision: number;
  encoding: DocumentEncoding;
  dirty: boolean;
  saving: boolean;
  loading: boolean;
  linkedDocumentIds: DocumentId[];
  diagnostics: DocumentDiagnostic[];
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
  registerDraft: (
    documentId: DocumentId,
    descriptor: WorkspaceDocument,
    text: string,
    options?: { saved?: boolean; encoding?: DocumentEncoding },
  ) => void;
  failOpen: (documentId: DocumentId, error: string) => void;
  updateWorkingText: (documentId: DocumentId, text: string) => void;
  setSaving: (documentId: DocumentId, saving: boolean) => void;
  markSaved: (
    documentId: DocumentId,
    result: DocumentSaveResult,
    savedText: string,
  ) => void;
  setConflict: (documentId: DocumentId, external: DocumentOpenResult) => void;
  keepLocal: (documentId: DocumentId) => void;
  reloadExternal: (
    documentId: DocumentId,
    external: DocumentOpenResult,
    imageUrl?: string,
  ) => void;
  markDeleted: (documentId: DocumentId) => void;
  setLinkedDocuments: (documentId: DocumentId, linkedIds: DocumentId[]) => void;
  setDiagnostics: (
    documentId: DocumentId,
    diagnostics: DocumentDiagnostic[],
  ) => void;
  applyDocumentMappings: (mappings: DocumentMapping[]) => void;
  closeDocument: (documentId: DocumentId) => void;
  clearProject: () => void;
}

export type DocumentStore = DocumentState & DocumentActions;

export const useDocumentStore = create<DocumentStore>()(
  subscribeWithSelector((set) => ({
    opened: {},
    beginOpen(documentId, descriptor) {
      set((state) => {
        const existing = state.opened[documentId];
        return {
          opened: {
            ...state.opened,
            [documentId]: {
              documentId,
              path: descriptor.path,
              descriptor,
              savedText: existing?.savedText ?? "",
              workingText: existing?.workingText ?? "",
              savedRevision: existing?.savedRevision ?? "",
              workingRevision: existing?.workingRevision ?? 0,
              encoding: existing?.encoding ?? "utf-8",
              dirty: existing?.dirty ?? false,
              saving: existing?.saving ?? false,
              loading: true,
              linkedDocumentIds: existing?.linkedDocumentIds ?? [],
              diagnostics: existing?.diagnostics ?? [],
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
      const text = result.content ?? "";
      set((state) => ({
        opened: {
          ...state.opened,
          [documentId]: {
            documentId,
            path: result.path,
            descriptor,
            savedText: text,
            workingText: text,
            savedRevision: result.revision,
            workingRevision: 0,
            encoding: result.encoding ?? "utf-8",
            dirty: false,
            saving: false,
            loading: false,
            linkedDocumentIds: state.opened[documentId]?.linkedDocumentIds ?? [],
            diagnostics: [],
            artifact: result.artifact,
            imageUrl,
          },
        },
      }));
    },
    registerDraft(documentId, descriptor, text, options) {
      const saved = options?.saved ?? false;
      set((state) => ({
        opened: {
          ...state.opened,
          [documentId]: {
            documentId,
            path: descriptor.path,
            descriptor,
            savedText: saved ? text : "",
            workingText: text,
            savedRevision: "",
            workingRevision: 0,
            encoding: options?.encoding ?? "utf-8",
            dirty: !saved,
            saving: false,
            loading: false,
            linkedDocumentIds: [],
            diagnostics: [],
          },
        },
      }));
    },
    failOpen(documentId, error) {
      updateOpened(set, documentId, (document) => ({
        ...document,
        loading: false,
        saving: false,
        error,
      }));
    },
    updateWorkingText(documentId, text) {
      updateOpened(set, documentId, (document) => {
        if (!document.descriptor.editable || document.workingText === text) return document;
        return {
          ...document,
          workingText: text,
          workingRevision: document.workingRevision + 1,
          dirty: text !== document.savedText,
          error: undefined,
        };
      });
    },
    setSaving(documentId, saving) {
      updateOpened(set, documentId, (document) => ({ ...document, saving }));
    },
    markSaved(documentId, result, savedText) {
      updateOpened(set, documentId, (document) => ({
        ...document,
        savedText,
        savedRevision: result.revision,
        encoding: result.encoding,
        dirty: document.workingText !== savedText,
        saving: false,
        conflict: undefined,
        error: undefined,
        deleted: false,
        descriptor: { ...document.descriptor, size: result.size },
      }));
    },
    setConflict(documentId, external) {
      updateOpened(set, documentId, (document) => {
        if (external.revision === document.savedRevision) return document;
        return {
          ...document,
          descriptor: descriptorFromOpenResult(external),
          conflict: {
            externalText: external.content ?? "",
            externalRevision: external.revision,
            externalEncoding: external.encoding ?? "utf-8",
          },
          loading: false,
          saving: false,
        };
      });
    },
    keepLocal(documentId) {
      updateOpened(set, documentId, (document) =>
        document.conflict
          ? {
              ...document,
              savedText: document.conflict.externalText,
              savedRevision: document.conflict.externalRevision,
              encoding: document.conflict.externalEncoding,
              dirty: document.workingText !== document.conflict.externalText,
              conflict: undefined,
            }
          : document,
      );
    },
    reloadExternal(documentId, external, imageUrl) {
      const descriptor = descriptorFromOpenResult(external);
      const text = external.content ?? "";
      set((state) => ({
        opened: {
          ...state.opened,
          [documentId]: {
            documentId,
            path: external.path,
            descriptor,
            savedText: text,
            workingText: text,
            savedRevision: external.revision,
            workingRevision: state.opened[documentId]?.workingRevision ?? 0,
            encoding: external.encoding ?? "utf-8",
            dirty: false,
            saving: false,
            loading: false,
            linkedDocumentIds: state.opened[documentId]?.linkedDocumentIds ?? [],
            diagnostics: [],
            artifact: external.artifact,
            imageUrl,
          },
        },
      }));
    },
    markDeleted(documentId) {
      updateOpened(set, documentId, (document) => ({
        ...document,
        deleted: true,
        dirty: true,
        saving: false,
      }));
    },
    setLinkedDocuments(documentId, linkedIds) {
      updateOpened(set, documentId, (document) => ({
        ...document,
        linkedDocumentIds: [...new Set(linkedIds)],
      }));
    },
    setDiagnostics(documentId, diagnostics) {
      updateOpened(set, documentId, (document) => ({
        ...document,
        diagnostics,
      }));
    },
    applyDocumentMappings(mappings) {
      set((state) => {
        const idMappings = new Map(
          mappings.map((mapping) => [
            asDocumentId(mapping.oldDocumentId),
            asDocumentId(mapping.newDocumentId),
          ]),
        );
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
        Object.entries(opened).forEach(([id, document]) => {
          opened[asDocumentId(id)] = {
            ...document,
            linkedDocumentIds: document.linkedDocumentIds.map(
              (linkedId) => idMappings.get(linkedId) ?? linkedId,
            ),
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
