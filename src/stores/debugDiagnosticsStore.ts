import { create } from "zustand";
import type { DebugDiagnostic, DebugEvent } from "../features/debug/types";

interface DebugDiagnosticsState {
  diagnostics: DebugDiagnostic[];
  setPreflightDiagnostics: (diagnostics: DebugDiagnostic[]) => void;
  appendFromEvent: (event: DebugEvent) => void;
  clearDiagnostics: () => void;
}

function diagnosticFromEvent(event: DebugEvent): DebugDiagnostic | undefined {
  if (event.kind !== "diagnostic") return undefined;
  const data = event.data;
  return {
    severity:
      data?.severity === "error" ||
      data?.severity === "warning" ||
      data?.severity === "info"
        ? data.severity
        : "info",
    code: typeof data?.code === "string" ? data.code : "debug_event",
    message:
      typeof data?.message === "string"
        ? data.message
        : event.maafwMessage ?? "调试诊断事件",
    fileId: typeof data?.fileId === "string" ? data.fileId : event.node?.fileId,
    nodeId: typeof data?.nodeId === "string" ? data.nodeId : event.node?.nodeId,
    fieldPath: typeof data?.fieldPath === "string" ? data.fieldPath : undefined,
    sourcePath:
      typeof data?.sourcePath === "string" ? data.sourcePath : undefined,
    data,
  };
}

export const useDebugDiagnosticsStore = create<DebugDiagnosticsState>((set) => ({
  diagnostics: [],

  setPreflightDiagnostics: (diagnostics) => set({ diagnostics }),

  appendFromEvent: (event) => {
    const diagnostic = diagnosticFromEvent(event);
    if (!diagnostic) return;
    set((state) => ({
      diagnostics: [...state.diagnostics, diagnostic],
    }));
  },

  clearDiagnostics: () => set({ diagnostics: [] }),
}));
