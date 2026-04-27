import { create } from "zustand";
import type {
  DebugCapabilityManifest,
  DebugModalPanel,
} from "../features/debug/types";

type CapabilityStatus = "idle" | "loading" | "ready" | "error";

interface DebugSessionState {
  modalOpen: boolean;
  activePanel: DebugModalPanel;
  selectedNodeId?: string;
  capabilities?: DebugCapabilityManifest;
  capabilityStatus: CapabilityStatus;
  capabilityError?: string;
  openModal: (panel?: DebugModalPanel) => void;
  closeModal: () => void;
  setActivePanel: (panel: DebugModalPanel) => void;
  selectNode: (nodeId?: string) => void;
  setCapabilitiesLoading: () => void;
  setCapabilities: (capabilities: DebugCapabilityManifest) => void;
  setCapabilitiesError: (message: string) => void;
}

export const useDebugSessionStore = create<DebugSessionState>((set) => ({
  modalOpen: false,
  activePanel: "overview",
  capabilityStatus: "idle",

  openModal: (panel) =>
    set((state) => ({
      modalOpen: true,
      activePanel: panel ?? state.activePanel,
    })),

  closeModal: () => set({ modalOpen: false }),

  setActivePanel: (panel) => set({ activePanel: panel }),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  setCapabilitiesLoading: () =>
    set({
      capabilityStatus: "loading",
      capabilityError: undefined,
    }),

  setCapabilities: (capabilities) =>
    set({
      capabilities,
      capabilityStatus: "ready",
      capabilityError: undefined,
    }),

  setCapabilitiesError: (message) =>
    set({
      capabilityStatus: "error",
      capabilityError: message,
    }),
}));
