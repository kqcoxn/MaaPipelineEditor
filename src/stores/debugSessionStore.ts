import { create } from "zustand";
import type {
  DebugCapabilityManifest,
  DebugModalPanel,
  DebugProtocolError,
  DebugRunStarted,
  DebugRunStopRequested,
  DebugSessionSnapshot,
  DebugScreenshotStreamStatus,
} from "../features/debug/types";

type CapabilityStatus = "idle" | "loading" | "ready" | "error";

interface DebugSessionState {
  modalOpen: boolean;
  activePanel: DebugModalPanel;
  selectedNodeId?: string;
  session?: DebugSessionSnapshot;
  activeRun?: DebugRunStarted;
  lastStopRequest?: DebugRunStopRequested;
  screenshotStream?: DebugScreenshotStreamStatus;
  lastError?: DebugProtocolError;
  capabilities?: DebugCapabilityManifest;
  capabilityStatus: CapabilityStatus;
  capabilityError?: string;
  openModal: (panel?: DebugModalPanel) => void;
  closeModal: () => void;
  setActivePanel: (panel: DebugModalPanel) => void;
  selectNode: (nodeId?: string) => void;
  setSessionSnapshot: (session: DebugSessionSnapshot) => void;
  clearSession: (sessionId?: string) => void;
  setRunStarted: (run: DebugRunStarted) => void;
  setRunStopRequested: (request: DebugRunStopRequested) => void;
  setScreenshotStreamStatus: (status: DebugScreenshotStreamStatus) => void;
  setProtocolError: (error: DebugProtocolError) => void;
  clearProtocolError: () => void;
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

  setSessionSnapshot: (session) => set({ session }),

  clearSession: (sessionId) =>
    set((state) => {
      if (sessionId && state.session?.sessionId !== sessionId) return {};
      return {
        session: undefined,
        activeRun: undefined,
        lastStopRequest: undefined,
        screenshotStream: undefined,
      };
    }),

  setRunStarted: (run) =>
    set({
      activeRun: run,
      session: run.session,
      lastError: undefined,
    }),

  setRunStopRequested: (request) => set({ lastStopRequest: request }),

  setScreenshotStreamStatus: (screenshotStream) => set({ screenshotStream }),

  setProtocolError: (error) => set({ lastError: error }),

  clearProtocolError: () => set({ lastError: undefined }),

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
