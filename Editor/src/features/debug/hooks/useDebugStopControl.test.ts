import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDebugStopControl } from "./useDebugStopControl";

const state = vi.hoisted(() => ({
  session: { sessionId: "session", status: "preparing" },
  activeRun: { runId: "previous-run" },
  lastError: undefined,
  clearProtocolError: vi.fn(),
}));
const stopRun = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/services/server", () => ({ debugProtocolClient: { stopRun } }));
vi.mock("@/features/achievements/bus", () => ({ emitAchievementEvent: vi.fn() }));
vi.mock("@/utils/ui/antdAppApi", () => ({ message: { warning: vi.fn(), error: vi.fn() } }));
vi.mock("@/stores/debug/debugSessionStore", () => ({
  useDebugSessionStore: Object.assign((selector: (value: typeof state) => unknown) => selector(state), { getState: () => state }),
}));

describe("stopping startup", () => {
  it("cancels preparation without sending a previous run ID and remains pending until acknowledgement", () => {
    const { result, rerender } = renderHook(() => useDebugStopControl());
    act(() => result.current.stopRun());
    expect(stopRun).toHaveBeenCalledWith({ sessionId: "session", runId: undefined, reason: "user_stop" });
    expect(result.current.stopPending).toBe(true);
    act(() => result.current.stopRun());
    expect(stopRun).toHaveBeenCalledTimes(1);
    state.session = { ...state.session, status: "idle" };
    rerender();
    expect(result.current.stopPending).toBe(false);
  });
});
