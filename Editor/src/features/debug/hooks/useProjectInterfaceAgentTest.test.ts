import { act, renderHook } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DebugAgentTestResult } from "../types";
import { useProjectInterfaceAgentTest } from "./useProjectInterfaceAgentTest";

const transport = vi.hoisted(() => ({
  listeners: new Set<(result: DebugAgentTestResult) => void>(),
  testAgent: vi.fn(() => true), stopAgent: vi.fn(() => true),
}));
vi.mock("@/services/server", () => ({ debugProtocolClient: {
  ...transport,
  onAgentTested: (listener: (result: DebugAgentTestResult) => void) => {
    transport.listeners.add(listener); return () => { transport.listeners.delete(listener); };
  },
} }));
vi.mock("@/utils/ui/antdAppApi", () => ({ message: { warning: vi.fn(), error: vi.fn() } }));

type PI = Parameters<typeof useProjectInterfaceAgentTest>[0]["projectInterface"];
const pi = { mode: "project_interface", context: { contextId: "context", agents: [{ id: "agent", enabled: true }] }, agentOverrides: {} } as PI;
const clear = () => {};

function useHarness(connected = true) {
  const [testing, setTesting] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const listener = (result: DebugAgentTestResult) => setTesting(current => new Set([...current].filter(id => id !== result.agentId)));
    transport.listeners.add(listener); return () => { transport.listeners.delete(listener); };
  }, []);
  const actions = useProjectInterfaceAgentTest({ projectInterface: pi, connected, setTestingAgentIds: setTesting, clearProtocolError: clear, clearAgentTestResult: clear, setAgentTestResult: clear });
  return { ...actions, testing };
}

describe("PI Agent startup waiting", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  it("keeps slow startup alive and waits for cancellation acknowledgement before retry", () => {
    const { result, unmount } = renderHook(() => useHarness());
    act(() => result.current.testProjectInterfaceAgent(0));
    act(() => vi.advanceTimersByTime(60000));
    expect(result.current.testing.has("agent")).toBe(true);
    expect(transport.stopAgent).not.toHaveBeenCalled();
    act(() => result.current.stopProjectInterfaceAgent(0));
    expect(result.current.stoppingAgentIds.has("agent")).toBe(true);
    expect(result.current.testing.has("agent")).toBe(true);
    act(() => result.current.testProjectInterfaceAgent(0));
    expect(transport.testAgent).toHaveBeenCalledTimes(1);
    act(() => transport.listeners.forEach(listener => listener({ agentId: "agent", success: false, checkedAt: "", message: "已取消", failureStage: "canceled" })));
    expect(result.current.testing.size).toBe(0);
    expect(result.current.stoppingAgentIds.size).toBe(0);
    act(() => result.current.testProjectInterfaceAgent(0));
    expect(transport.testAgent).toHaveBeenCalledTimes(2);
    unmount();
    expect(transport.stopAgent).toHaveBeenLastCalledWith({ projectContextId: "context", agentIndex: 0 });
  });

  it("clears pending state on disconnect", () => {
    const { result, rerender } = renderHook(({ connected }) => useHarness(connected), { initialProps: { connected: true } });
    act(() => result.current.testProjectInterfaceAgent(0));
    rerender({ connected: false });
    expect(result.current.testing.size).toBe(0);
    expect(result.current.stoppingAgentIds.size).toBe(0);
  });
});
