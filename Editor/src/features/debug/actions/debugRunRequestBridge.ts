import type {
  DebugNodeTarget,
  DebugRunMode,
  DebugRunRequest,
} from "../types";

export interface DebugRunRequestIntent {
  target: DebugNodeTarget;
  mode: DebugRunMode;
  input?: DebugRunRequest["input"];
}

type DebugRunRequestListener = (intent: DebugRunRequestIntent) => void;

const listeners = new Set<DebugRunRequestListener>();
let pendingIntent: DebugRunRequestIntent | undefined;

export function requestDebugRun(intent: DebugRunRequestIntent): boolean {
  if (listeners.size === 0) {
    // DebugModal is lazy-loaded. Keep the latest request until its controller
    // subscribes instead of reporting a transient initialization failure.
    pendingIntent = intent;
    return true;
  }
  listeners.forEach((listener) => listener(intent));
  return true;
}

/** Queue an intent for the lazily mounted debug content without notifying the host. */
export function queueDebugRun(intent: DebugRunRequestIntent): void {
  pendingIntent = intent;
}

export function subscribeDebugRunRequests(
  listener: DebugRunRequestListener,
): () => void {
  listeners.add(listener);
  if (pendingIntent) {
    const intent = pendingIntent;
    pendingIntent = undefined;
    listener(intent);
  }
  return () => listeners.delete(listener);
}
