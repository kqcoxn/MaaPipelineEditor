import { create } from "zustand";
import type {
  DebugAgentTestResult,
  DebugCapabilityManifest,
  DebugModalPanel,
  DebugResourceHealthResult,
  DebugProtocolError,
  DebugResourcePreflightResult,
  DebugRunStarted,
  DebugRunStopRequested,
  DebugSessionSnapshot,
} from "../features/debug/types";
import { useDebugModalMemoryStore } from "./debugModalMemoryStore";

type CapabilityStatus = "idle" | "loading" | "ready" | "error";
type ResourcePreflightStatus = "idle" | "checking" | "ready" | "error";
type ResourceHealthStatus = "idle" | "checking" | "ready" | "error";

export interface DebugResourcePreflightState {
  status: ResourcePreflightStatus;
  requestId?: string;
  resourceKey?: string;
  result?: DebugResourcePreflightResult;
  error?: string;
}

export interface DebugResourceHealthState {
  status: ResourceHealthStatus;
  requestId?: string;
  requestKey?: string;
  result?: DebugResourceHealthResult;
  error?: string;
}

interface DebugSessionState {
  modalOpen: boolean;
  activePanel: DebugModalPanel;
  selectedNodeId?: string;
  session?: DebugSessionSnapshot;
  activeRun?: DebugRunStarted;
  lastStopRequest?: DebugRunStopRequested;
  agentTestResults: Record<string, DebugAgentTestResult>;
  lastError?: DebugProtocolError;
  capabilities?: DebugCapabilityManifest;
  capabilityStatus: CapabilityStatus;
  capabilityError?: string;
  resourcePreflight: DebugResourcePreflightState;
  resourceHealth: DebugResourceHealthState;
  openModal: (panel?: DebugModalPanel) => void;
  closeModal: () => void;
  setActivePanel: (panel: DebugModalPanel) => void;
  selectNode: (nodeId?: string) => void;
  setSessionSnapshot: (session: DebugSessionSnapshot) => void;
  clearSession: (sessionId?: string) => void;
  setRunStarted: (run: DebugRunStarted) => void;
  setRunStopRequested: (request: DebugRunStopRequested) => void;
  setAgentTestResult: (result: DebugAgentTestResult) => void;
  setProtocolError: (error: DebugProtocolError) => void;
  clearProtocolError: () => void;
  setCapabilitiesLoading: () => void;
  setCapabilities: (capabilities: DebugCapabilityManifest) => void;
  setCapabilitiesError: (message: string) => void;
  setResourcePreflightChecking: (requestId: string, resourceKey: string) => void;
  setResourcePreflightResult: (result: DebugResourcePreflightResult) => void;
  setResourcePreflightError: (
    requestId: string,
    resourceKey: string,
    message: string,
  ) => void;
  invalidateResourcePreflight: () => void;
  setResourceHealthChecking: (requestId: string, requestKey: string) => void;
  setResourceHealthResult: (result: DebugResourceHealthResult) => void;
  setResourceHealthError: (
    requestId: string,
    requestKey: string,
    message: string,
  ) => void;
  invalidateResourceHealth: () => void;
}

export const useDebugSessionStore = create<DebugSessionState>((set) => ({
  modalOpen: false,
  activePanel: "overview",
  capabilityStatus: "idle",
  agentTestResults: {},
  resourcePreflight: {
    status: "idle",
  },
  resourceHealth: {
    status: "idle",
  },

  openModal: (panel) =>
    set((state) => ({
      modalOpen: true,
      activePanel:
        panel ??
        useDebugModalMemoryStore.getState().lastPanel ??
        state.activePanel,
    })),

  closeModal: () =>
    set((state) => {
      useDebugModalMemoryStore.getState().setLastPanel(state.activePanel);
      return { modalOpen: false };
    }),

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
        agentTestResults: {},
      };
    }),

  setRunStarted: (run) =>
    set({
      activeRun: run,
      session: run.session,
      lastError: undefined,
    }),

  setRunStopRequested: (request) => set({ lastStopRequest: request }),

  setAgentTestResult: (result) =>
    set((state) => ({
      agentTestResults: {
        ...state.agentTestResults,
        [result.agentId]: result,
      },
    })),

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

  setResourcePreflightChecking: (requestId, resourceKey) =>
    set({
      resourcePreflight: {
        status: "checking",
        requestId,
        resourceKey,
      },
    }),

  setResourcePreflightResult: (result) =>
    set((state) => {
      const current = state.resourcePreflight;
      if (current.requestId && result.requestId !== current.requestId) return {};
      const firstError = result.diagnostics?.find(
        (diagnostic) => diagnostic.severity === "error",
      );
      return {
        resourcePreflight: {
          status: result.status === "ready" ? "ready" : "error",
          requestId: result.requestId,
          resourceKey:
            current.requestId === result.requestId
              ? current.resourceKey
              : makeResourceKey(result.resourcePaths),
          result,
          error: firstError?.message,
        },
      };
    }),

  setResourcePreflightError: (requestId, resourceKey, message) =>
    set({
      resourcePreflight: {
        status: "error",
        requestId,
        resourceKey,
        error: message,
      },
    }),

  invalidateResourcePreflight: () =>
    set({
      resourcePreflight: {
        status: "idle",
      },
    }),

  setResourceHealthChecking: (requestId, requestKey) =>
    set({
      resourceHealth: {
        status: "checking",
        requestId,
        requestKey,
      },
    }),

  setResourceHealthResult: (result) =>
    set((state) => {
      const current = state.resourceHealth;
      if (!current.requestId || result.requestId !== current.requestId) {
        return {};
      }
      const firstError = result.diagnostics?.find(
        (diagnostic) => diagnostic.severity === "error",
      );
      return {
        resourceHealth: {
          status: result.status === "ready" ? "ready" : "error",
          requestId: result.requestId,
          requestKey: current.requestKey,
          result,
          error: firstError?.message,
        },
      };
    }),

  setResourceHealthError: (requestId, requestKey, message) =>
    set({
      resourceHealth: {
        status: "error",
        requestId,
        requestKey,
        error: message,
      },
    }),

  invalidateResourceHealth: () =>
    set({
      resourceHealth: {
        status: "idle",
      },
    }),
}));

function makeResourceKey(resourcePaths: string[]): string {
  return resourcePaths.map((path) => path.trim()).filter(Boolean).join("\n");
}
