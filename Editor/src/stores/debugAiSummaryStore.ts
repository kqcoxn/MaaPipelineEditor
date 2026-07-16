import { create } from "zustand";

export type DebugAiSummaryStatus = "idle" | "generating" | "ready" | "error";
export type DebugAiSummaryKind = "run" | "node";
export type DebugAiSummaryFocus = "full" | "failure" | "node";

export interface DebugAiSummaryTarget {
  kind: DebugAiSummaryKind;
  sessionId?: string;
  runId?: string;
  displaySessionId?: string;
  nodeRecordId?: string;
  nodeLabel?: string;
  generatedAt?: string;
}

export interface DebugAiSummaryReport {
  id: string;
  target: DebugAiSummaryTarget;
  focus: DebugAiSummaryFocus;
  simpleSummary: string;
  detailedReport: string;
  prompt: string;
  contextText: string;
  rawResponse: string;
  generatedAt: string;
}

interface DebugAiSummaryState {
  status: DebugAiSummaryStatus;
  activeReport?: DebugAiSummaryReport;
  error?: string;
  autoRequestedTargetIds: string[];
  setGenerating: (target: DebugAiSummaryTarget) => void;
  setReport: (report: DebugAiSummaryReport) => void;
  setError: (message: string) => void;
  markAutoRequested: (targetId: string) => void;
  reset: () => void;
}

export function debugAiSummaryTargetKey(
  target: DebugAiSummaryTarget,
): string {
  return [
    target.kind,
    target.sessionId ?? "",
    target.runId ?? "",
    target.nodeRecordId ?? "",
  ].join(":");
}

export const useDebugAiSummaryStore = create<DebugAiSummaryState>((set) => ({
  status: "idle",
  autoRequestedTargetIds: [],

  setGenerating: (target) =>
    set({
      status: "generating",
      error: undefined,
      activeReport: {
        id: `pending-${Date.now()}`,
        target,
        focus: target.kind === "node" ? "node" : "full",
        simpleSummary: "",
        detailedReport: "",
        prompt: "",
        contextText: "",
        rawResponse: "",
        generatedAt: new Date().toISOString(),
      },
    }),

  setReport: (activeReport) =>
    set({
      status: "ready",
      activeReport,
      error: undefined,
    }),

  setError: (error) =>
    set({
      status: "error",
      error,
    }),

  markAutoRequested: (targetId) =>
    set((state) => ({
      autoRequestedTargetIds: state.autoRequestedTargetIds.includes(targetId)
        ? state.autoRequestedTargetIds
        : [...state.autoRequestedTargetIds, targetId],
    })),

  reset: () =>
    set({
      status: "idle",
      activeReport: undefined,
      error: undefined,
      autoRequestedTargetIds: [],
    }),
}));
