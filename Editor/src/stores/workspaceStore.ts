import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

import type {
  ProjectDiscoveryCandidate,
  ProjectDiscoveryStatus,
} from "../services/generated/bridge-v2";

export type WorkspaceStateName =
  | "disconnected"
  | ProjectDiscoveryStatus["state"];

export interface WorkspaceInterfaceCandidate {
  candidate_id: string;
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
}

interface WorkspaceActions {
  applyDiscovery: (status: ProjectDiscoveryStatus) => void;
  prepareReconnect: () => void;
  openSelector: () => void;
  closeSelector: () => void;
  clear: () => void;
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;

const initialWorkspaceState: WorkspaceState = {
  revision: 0,
  root: "",
  state: "disconnected",
  reason: "",
  candidates: [],
  currentInterface: null,
  indexedFiles: 0,
  totalFiles: 0,
  diagnostics: [],
  selectorOpen: false,
};

export const useWorkspaceStore = create<WorkspaceStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialWorkspaceState,
    applyDiscovery(status) {
      if (status.revision < get().revision) return;
      const candidates = status.candidates.map(mapCandidate);
      set({
        revision: status.revision,
        root: status.discoveryRoot,
        state: status.state,
        reason: status.reason,
        candidates,
        currentInterface: status.currentInterface
          ? mapCandidate(status.currentInterface)
          : null,
        indexedFiles: status.indexedFiles,
        totalFiles: status.totalFiles,
        diagnostics: status.diagnostics.filter(isDiagnostic),
        selectorOpen:
          status.state === "selection_required" ||
          (get().selectorOpen && candidates.length > 1),
      });
    },
    prepareReconnect() {
      set({ revision: 0, state: "disconnected" });
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

function mapCandidate(candidate: ProjectDiscoveryCandidate): WorkspaceInterfaceCandidate {
  return {
    candidate_id: candidate.candidateId,
    interface_path: candidate.interfacePath,
    name: candidate.name,
    label: candidate.label,
    version: candidate.version,
  };
}

function isDiagnostic(value: unknown): value is WorkspaceDiagnostic {
  if (!value || typeof value !== "object") return false;
  const diagnostic = value as Record<string, unknown>;
  return (
    typeof diagnostic.code === "string" &&
    typeof diagnostic.message === "string" &&
    typeof diagnostic.path === "string" &&
    (diagnostic.severity === "warning" || diagnostic.severity === "error")
  );
}
