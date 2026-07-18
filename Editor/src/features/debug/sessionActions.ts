import { debugProtocolClient } from "../../services/server";
import { useDebugSessionStore } from "../../stores/debugSessionStore";
import type { DebugSessionSnapshot } from "./types";

let lifecycleRevision = 0;
let sessionCreation:
  | {
      revision: number;
      promise: Promise<DebugSessionSnapshot>;
    }
  | undefined;

export function ensureDebugSession(): Promise<DebugSessionSnapshot> {
  const existing = useDebugSessionStore.getState().session;
  if (existing?.sessionId) return Promise.resolve(existing);
  if (!debugProtocolClient.isConnected()) {
    return Promise.reject(new Error("LocalBridge 未连接，无法创建调试会话"));
  }

  if (sessionCreation?.revision === lifecycleRevision) {
    return sessionCreation.promise;
  }

  const revision = lifecycleRevision;
  const promise = debugProtocolClient
    .createSession({ name: "MPE Debug Session" })
    .then((snapshot) => {
      if (revision !== lifecycleRevision) {
        throw new Error("LocalBridge 连接已变化，请重新启动调试");
      }
      useDebugSessionStore.getState().setSessionSnapshot(snapshot);
      return snapshot;
    })
    .finally(() => {
      if (sessionCreation?.promise === promise) {
        sessionCreation = undefined;
      }
    });
  sessionCreation = { revision, promise };
  return promise;
}

export function resetDebugSessionLifecycle(): void {
  lifecycleRevision += 1;
  sessionCreation = undefined;
  useDebugSessionStore.getState().clearSession();
}
