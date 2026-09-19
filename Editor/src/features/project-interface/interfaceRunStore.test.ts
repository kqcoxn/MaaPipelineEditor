import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InterfaceRunEvent } from "@/services/protocols/InterfaceRunProtocol";
import { initializeInterfaceRun, startInterfaceRun, useInterfaceRunStore } from "./interfaceRunStore";
import { useProjectInterfaceStore as pi } from "./projectInterfaceStore";
import { useWSStore } from "@/stores/connection/wsStore";
import { useMFWStore } from "@/stores/connection/mfwStore";
import { emptyPreferences, scopeKey } from "./projectPreferences";
import type { InterfaceRunState } from "./interfaceRunTypes";

const protocol = vi.hoisted(() => ({ listener: undefined as ((event: InterfaceRunEvent) => void) | undefined, start: vi.fn((_request: unknown) => true), status: vi.fn(() => true), stop: vi.fn(), prepare: vi.fn() }));
vi.mock("@/services/server", () => ({ interfaceRunProtocol: { ...protocol, subscribe: (listener: (event: InterfaceRunEvent) => void) => { protocol.listener = listener; return () => { protocol.listener = undefined; }; } } }));
const runtime = (overrides: Partial<InterfaceRunState> = {}): InterfaceRunState => ({ runId: "run", requestId: "request", projectId: "p", revision: "r", controllerId: "device", controllerName: "mac", resourceName: "base", status: "running", items: [], logs: [], sequence: 1, startedAt: "2026-09-19T00:00:00Z", ...overrides });
let dispose: () => void;
beforeEach(() => {
  vi.useFakeTimers(); protocol.start.mockClear(); protocol.status.mockClear();
  useInterfaceRunStore.setState({ run: undefined, pending: undefined, preparation: undefined, error: undefined });
  useWSStore.setState({ connected: true });
  useMFWStore.setState({ controllerId: "device", controllerType: "macos", connectionStatus: "connected" });
  const preferences = { ...emptyPreferences(), controllerName: "mac", resourceName: "base", taskName: "a", taskOrder: ["b", "a"], checkedTaskNames: ["a", "b"] };
  preferences.values[scopeKey("task", preferences, "a")] = { mode: "one" };
  preferences.values[scopeKey("task", preferences, "b")] = { mode: "two" };
  pi.setState({ preferences, snapshot: { projectId: "p", revision: "r", language: "zh_cn", entryPath: "/p/interface.json", interfaceRoot: "/p", projectRoot: "/p", document: { task: [{ name: "a", entry: "DynamicA" }, { name: "b", entry: "DynamicB" }] } } });
  dispose = initializeInterfaceRun();
});
afterEach(() => { dispose(); vi.useRealTimers(); });
describe("independent Interface runtime", () => {
  it("submits the checked order and scoped values without a canvas or debug context", () => {
    startInterfaceRun(); startInterfaceRun();
    expect(protocol.start).toHaveBeenCalledTimes(1);
    const request = protocol.start.mock.calls[0][0] as unknown as { tasks: Array<{ taskName: string; optionValues: { task: unknown } }> };
    expect(request.tasks.map(task => task.taskName)).toEqual(["b", "a"]);
    expect(request.tasks.map(task => task.optionValues.task)).toEqual([{ mode: "two" }, { mode: "one" }]);
    expect(request).not.toHaveProperty("resolverSnapshot");
    expect(request).not.toHaveProperty("projectContextId");
  });
  it("ignores out-of-order states and keeps the running configuration when browsing changes", () => {
    protocol.listener!({ type: "state", data: runtime({ sequence: 8 }) });
    pi.getState().selectTask("b");
    protocol.listener!({ type: "state", data: runtime({ sequence: 3, status: "preparing" }) });
    expect(useInterfaceRunStore.getState().run?.sequence).toBe(8);
    expect(useInterfaceRunStore.getState().run?.status).toBe("running");
    startInterfaceRun(); expect(protocol.start).not.toHaveBeenCalled();
  });
  it("correlates rejection and requires another explicit click after device correction", () => {
    useMFWStore.setState({ connectionStatus: "disconnected" });
    startInterfaceRun(); expect(protocol.start).not.toHaveBeenCalled();
    useMFWStore.setState({ connectionStatus: "connected" });
    expect(protocol.start).not.toHaveBeenCalled();
    startInterfaceRun(); const id = useInterfaceRunStore.getState().pending!.id;
    protocol.listener!({ type: "error", data: { requestId: "stale", message: "old" } });
    expect(useInterfaceRunStore.getState().pending?.id).toBe(id);
    protocol.listener!({ type: "error", data: { requestId: id, message: "配置无效" } });
    expect(useInterfaceRunStore.getState().pending).toBeUndefined();
    expect(useInterfaceRunStore.getState().error).toBe("配置无效");
  });
  it("resynchronizes backend state after reconnect without restarting the queue", () => {
    protocol.listener!({ type: "state", data: runtime() });
    useWSStore.setState({ connected: false }); useWSStore.setState({ connected: true });
    expect(protocol.status).toHaveBeenCalledTimes(2);
    protocol.listener!({ type: "state", data: runtime({ status: "completed", sequence: 20 }) });
    expect(useInterfaceRunStore.getState().run?.status).toBe("completed");
    expect(protocol.start).not.toHaveBeenCalled();
  });
});
