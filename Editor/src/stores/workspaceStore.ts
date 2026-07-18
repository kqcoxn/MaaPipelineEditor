import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

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
  root: string;
  state: WorkspaceStateName;
  reason: string;
  candidates: WorkspaceInterfaceCandidate[];
  currentInterface: WorkspaceInterfaceCandidate | null;
  indexedFiles: number;
  totalFiles: number;
  diagnostics: WorkspaceDiagnostic[];
  selectorOpen: boolean;
  applyStatus: (status: WorkspaceStatusPayload) => void;
  openSelector: () => void;
  closeSelector: () => void;
  clear: () => void;
}

const initialWorkspaceState = {
  revision: 0,
  root: "",
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
