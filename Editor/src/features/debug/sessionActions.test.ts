import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DebugSessionSnapshot } from "./types";
import { useDebugSessionStore } from "../../stores/debugSessionStore";
import {
  ensureDebugSession,
  resetDebugSessionLifecycle,
} from "./sessionActions";

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  isConnected: vi.fn(() => true),
}));

vi.mock("../../services/server", () => ({
  debugProtocolClient: mocks,
}));

function createSnapshot(sessionId: string): DebugSessionSnapshot {
  return {
    sessionId,
    name: "MPE Debug Session",
    status: "idle",
    createdAt: "2026-07-19T00:00:00.000Z",
    updatedAt: "2026-07-19T00:00:00.000Z",
  } as DebugSessionSnapshot;
}

beforeEach(() => {
  resetDebugSessionLifecycle();
  mocks.createSession.mockReset();
  mocks.isConnected.mockReset();
  mocks.isConnected.mockReturnValue(true);
});

describe("debug session lifecycle", () => {
  it("creates one session for concurrent run requests", async () => {
    const snapshot = createSnapshot("session-1");
    mocks.createSession.mockResolvedValue(snapshot);

    const [first, second] = await Promise.all([
      ensureDebugSession(),
      ensureDebugSession(),
    ]);

    expect(mocks.createSession).toHaveBeenCalledTimes(1);
    expect(first).toBe(snapshot);
    expect(second).toBe(snapshot);
    expect(useDebugSessionStore.getState().session).toBe(snapshot);
  });

  it("reuses the active session", async () => {
    const snapshot = createSnapshot("session-1");
    useDebugSessionStore.getState().setSessionSnapshot(snapshot);

    await expect(ensureDebugSession()).resolves.toBe(snapshot);
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("clears the active session when the connection resets", () => {
    useDebugSessionStore
      .getState()
      .setSessionSnapshot(createSnapshot("session-1"));

    resetDebugSessionLifecycle();

    expect(useDebugSessionStore.getState().session).toBeUndefined();
  });

  it("rejects a session created by an outdated connection", async () => {
    let resolveCreation: ((snapshot: DebugSessionSnapshot) => void) | undefined;
    mocks.createSession.mockImplementation(
      () =>
        new Promise<DebugSessionSnapshot>((resolve) => {
          resolveCreation = resolve;
        }),
    );
    const pending = ensureDebugSession();

    resetDebugSessionLifecycle();
    resolveCreation?.(createSnapshot("stale-session"));

    await expect(pending).rejects.toThrow("LocalBridge 连接已变化");
    expect(useDebugSessionStore.getState().session).toBeUndefined();
  });
});
