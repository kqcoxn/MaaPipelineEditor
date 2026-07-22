import { create } from "zustand";

import type {
  ArtifactRef,
  DocumentOpenResult,
  WorkspaceDocument,
  WorkspaceDocumentsPayload,
} from "../services/generated/bridge-v2";
import {
  projectPathName,
  remapProjectPath,
} from "../utils/projectPath";

export interface DocumentConflict {
  externalContent: string;
  externalRevision: string;
}

export interface OpenDocument {
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
  revision: number;
  root: string;
  documents: Record<string, WorkspaceDocument>;
  opened: Record<string, OpenDocument>;
  applyDocuments: (payload: WorkspaceDocumentsPayload) => void;
  prepareReconnect: () => void;
  beginOpen: (path: string) => boolean;
  finishOpen: (result: DocumentOpenResult, imageUrl?: string) => void;
  failOpen: (path: string, error: string) => void;
  updateContent: (path: string, content: string) => void;
  markSaved: (path: string, revision: string, savedContent: string) => void;
  setConflict: (path: string, external: DocumentOpenResult) => void;
  keepLocal: (path: string) => void;
  reloadExternal: (path: string, external: DocumentOpenResult, imageUrl?: string) => void;
  markDeleted: (path: string) => void;
  renamePath: (oldPath: string, newPath: string, isDirectory: boolean) => void;
  closeDocument: (path: string) => void;
  clearProject: () => void;
}

const initialState = {
  revision: 0,
  root: "",
  documents: {} as Record<string, WorkspaceDocument>,
  opened: {} as Record<string, OpenDocument>,
};

export const useDocumentStore = create<DocumentState>()((set, get) => ({
  ...initialState,
  applyDocuments(payload) {
    const state = get();
    const sameRoot = !state.root || state.root === payload.root;
    if (sameRoot && payload.revision < state.revision) return;
    const documents = Object.fromEntries(
      payload.documents.map((document) => [document.path, document]),
    );
    if (!sameRoot) {
      const opened = Object.fromEntries(
        Object.entries(state.opened).map(([path, document]) => [
          path,
          { ...document, deleted: true },
        ]),
      );
      set({ revision: payload.revision, root: payload.root, documents, opened });
      return;
    }
    const opened = Object.fromEntries(
      Object.entries(state.opened).map(([path, document]) => [
        path,
        documents[path]
          ? { ...document, descriptor: documents[path], deleted: false }
          : { ...document, deleted: true },
      ]),
    );
    set({ revision: payload.revision, root: payload.root, documents, opened });
  },
  prepareReconnect() {
    set({ revision: 0 });
  },
  beginOpen(path) {
    const descriptor = get().documents[path];
    if (!descriptor || descriptor.kind === "pipeline") return false;
    set((state) => ({
      opened: {
        ...state.opened,
        [path]: {
          path,
          descriptor,
          content: state.opened[path]?.content ?? "",
          savedContent: state.opened[path]?.savedContent ?? "",
          baseRevision: state.opened[path]?.baseRevision ?? "",
          dirty: state.opened[path]?.dirty ?? false,
          loading: true,
          conflict: state.opened[path]?.conflict,
          artifact: state.opened[path]?.artifact,
          imageUrl: state.opened[path]?.imageUrl,
        },
      },
    }));
    return true;
  },
  finishOpen(result, imageUrl) {
    const descriptor = descriptorFromOpenResult(result);
    const content = result.content ?? "";
    set((state) => ({
      documents: { ...state.documents, [result.path]: descriptor },
      opened: {
        ...state.opened,
        [result.path]: {
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
  failOpen(path, error) {
    set((state) => {
      const document = state.opened[path];
      if (!document) return state;
      return {
        opened: {
          ...state.opened,
          [path]: { ...document, loading: false, error },
        },
      };
    });
  },
  updateContent(path, content) {
    set((state) => {
      const document = state.opened[path];
      if (!document || !document.descriptor.editable) return state;
      return {
        opened: {
          ...state.opened,
          [path]: {
            ...document,
            content,
            dirty: content !== document.savedContent,
          },
        },
      };
    });
  },
  markSaved(path, revision, savedContent) {
    set((state) => {
      const document = state.opened[path];
      if (!document) return state;
      return {
        opened: {
          ...state.opened,
          [path]: {
            ...document,
            savedContent,
            baseRevision: revision,
            dirty: document.content !== savedContent,
            conflict: undefined,
            error: undefined,
          },
        },
      };
    });
  },
  setConflict(path, external) {
    set((state) => {
      const document = state.opened[path];
      if (!document) return state;
      return {
        opened: {
          ...state.opened,
          [path]: {
            ...document,
            descriptor: descriptorFromOpenResult(external),
            conflict: {
              externalContent: external.content ?? "",
              externalRevision: external.revision,
            },
            loading: false,
          },
        },
      };
    });
  },
  keepLocal(path) {
    set((state) => {
      const document = state.opened[path];
      if (!document?.conflict) return state;
      return {
        opened: {
          ...state.opened,
          [path]: {
            ...document,
            savedContent: document.conflict.externalContent,
            baseRevision: document.conflict.externalRevision,
            dirty: document.content !== document.conflict.externalContent,
            conflict: undefined,
          },
        },
      };
    });
  },
  reloadExternal(path, external, imageUrl) {
    const descriptor = descriptorFromOpenResult(external);
    const content = external.content ?? "";
    set((state) => ({
      documents: { ...state.documents, [path]: descriptor },
      opened: {
        ...state.opened,
        [path]: {
          path,
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
  markDeleted(path) {
    set((state) => {
      const document = state.opened[path];
      if (!document) return state;
      return {
        opened: {
          ...state.opened,
          [path]: { ...document, deleted: true },
        },
      };
    });
  },
  renamePath(oldPath, newPath, isDirectory) {
    set((state) => {
      const documents = remapDocumentRecord(
        state.documents,
        oldPath,
        newPath,
        isDirectory,
        (descriptor, path) => ({
          ...descriptor,
          path,
          name: projectPathName(path),
        }),
      );
      const opened = remapDocumentRecord(
        state.opened,
        oldPath,
        newPath,
        isDirectory,
        (document, path) => ({
          ...document,
          path,
          descriptor: {
            ...document.descriptor,
            path,
            name: projectPathName(path),
          },
        }),
      );
      return { documents, opened };
    });
  },
  closeDocument(path) {
    set((state) => {
      const opened = { ...state.opened };
      delete opened[path];
      return { opened };
    });
  },
  clearProject() {
    set(initialState);
  },
}));

function remapDocumentRecord<T>(
  record: Record<string, T>,
  oldPath: string,
  newPath: string,
  isDirectory: boolean,
  update: (value: T, path: string) => T,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).map(([path, value]) => {
      const remappedPath = remapProjectPath(
        path,
        oldPath,
        newPath,
        isDirectory,
      );
      return [remappedPath, update(value, remappedPath)];
    }),
  );
}

export function getDirtyDocumentPaths(): string[] {
  return Object.values(useDocumentStore.getState().opened)
    .filter((document) => document.dirty)
    .map((document) => document.path);
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
