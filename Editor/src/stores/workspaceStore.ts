import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type {
  WorkspaceTreeEntry,
  WorkspaceTreePayload,
} from "../services/generated/bridge-v2";
import {
  projectPathName,
  remapProjectPath,
} from "../utils/projectPath";

export type { WorkspaceTreeEntry, WorkspaceTreePayload };

export type WorkspaceStateName =
  | "disconnected"
  | "discovering"
  | "selection_required"
  | "indexing"
  | "ready"
  | "invalid";

export interface WorkspaceInterfaceCandidate {
  interface_path: string;
  name: string;
  label: string;
  version: string;
}

export interface WorkspaceDiagnostic {
  code: string;
  message: string;
  path: string;
  severity: "warning" | "error";
}

export interface WorkspaceStatusPayload {
  revision: number;
  root: string;
  state: Exclude<WorkspaceStateName, "disconnected">;
  reason: string;
  candidates: WorkspaceInterfaceCandidate[];
  current_interface: WorkspaceInterfaceCandidate | null;
  indexed_files: number;
  total_files: number;
  diagnostics: WorkspaceDiagnostic[];
}

interface WorkspaceState {
  revision: number;
  treeRevision: number;
  root: string;
  treeRoot: string;
  treeEntries: WorkspaceTreeEntry[];
  state: WorkspaceStateName;
  reason: string;
  candidates: WorkspaceInterfaceCandidate[];
  currentInterface: WorkspaceInterfaceCandidate | null;
  indexedFiles: number;
  totalFiles: number;
  diagnostics: WorkspaceDiagnostic[];
  selectorOpen: boolean;
  applyStatus: (status: WorkspaceStatusPayload) => void;
  applyTree: (tree: WorkspaceTreePayload) => void;
  prepareReconnect: () => void;
  renamePath: (oldPath: string, newPath: string, isDirectory: boolean) => void;
  openSelector: () => void;
  closeSelector: () => void;
  clear: () => void;
}

const initialWorkspaceState = {
  revision: 0,
  treeRevision: 0,
  root: "",
  treeRoot: "",
  treeEntries: [] as WorkspaceTreeEntry[],
  state: "disconnected" as const,
  reason: "",
  candidates: [] as WorkspaceInterfaceCandidate[],
  currentInterface: null as WorkspaceInterfaceCandidate | null,
  indexedFiles: 0,
  totalFiles: 0,
  diagnostics: [] as WorkspaceDiagnostic[],
  selectorOpen: false,
};

export const useWorkspaceStore = create<WorkspaceState>()(
  subscribeWithSelector((set, get) => ({
    ...initialWorkspaceState,
    applyStatus(status) {
      if (status.revision < get().revision) return;
      set({
        revision: status.revision,
        root: status.root,
        state: status.state,
        reason: status.reason,
        candidates: status.candidates,
        currentInterface: status.current_interface,
        indexedFiles: status.indexed_files,
        totalFiles: status.total_files,
        diagnostics: status.diagnostics,
        selectorOpen:
          status.state === "selection_required" ||
          (get().selectorOpen && status.candidates.length > 1),
      });
    },
    applyTree(tree) {
      if (tree.revision < get().treeRevision) return;
      set({
        treeRevision: tree.revision,
        treeRoot: tree.root,
        treeEntries: tree.entries,
      });
    },
    prepareReconnect() {
      set({ revision: 0, treeRevision: 0 });
    },
    renamePath(oldPath, newPath, isDirectory) {
      set((state) => ({
        treeEntries: state.treeEntries.map((entry) => {
          const path = remapProjectPath(
            entry.path,
            oldPath,
            newPath,
            isDirectory,
          );
          return path === entry.path
            ? entry
            : { ...entry, path, name: projectPathName(path) };
        }),
        candidates: state.candidates.map((candidate) => ({
          ...candidate,
          interface_path: remapProjectPath(
            candidate.interface_path,
            oldPath,
            newPath,
            isDirectory,
          ),
        })),
        currentInterface: state.currentInterface
          ? {
              ...state.currentInterface,
              interface_path: remapProjectPath(
                state.currentInterface.interface_path,
                oldPath,
                newPath,
                isDirectory,
              ),
            }
          : null,
        diagnostics: state.diagnostics.map((diagnostic) => ({
          ...diagnostic,
          path: remapProjectPath(
            diagnostic.path,
            oldPath,
            newPath,
            isDirectory,
          ),
        })),
      }));
    },
    openSelector() {
      if (get().candidates.length > 1) set({ selectorOpen: true });
    },
    closeSelector() {
      if (get().state !== "selection_required") set({ selectorOpen: false });
    },
    clear() {
      set(initialWorkspaceState);
    },
  })),
);
