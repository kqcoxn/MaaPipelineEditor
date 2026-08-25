import type { DebugRunMode, DebugRunRequest } from "../types";

export interface DebugRunRequestIntent {
  nodeId: string;
  mode: DebugRunMode;
  input?: DebugRunRequest["input"];
}

type DebugRunRequestListener = (intent: DebugRunRequestIntent) => void;

const listeners = new Set<DebugRunRequestListener>();

export function requestDebugRun(intent: DebugRunRequestIntent): boolean {
  if (listeners.size === 0) return false;
  listeners.forEach((listener) => listener(intent));
  return true;
}

export function subscribeDebugRunRequests(
  listener: DebugRunRequestListener,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
