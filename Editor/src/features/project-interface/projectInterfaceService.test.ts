vi.mock("./interfaceRunStore", () => ({ initializeInterfaceRun: () => () => {} }));
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectInterfaceRuntimePlan, ProjectInterfaceSnapshot } from "./types";
import { useProjectInterfaceStore as store, emptyContexts } from "./projectInterfaceStore";
import { emptyPreferences } from "./projectPreferences";
import { useWSStore } from "@/stores/connection/wsStore";

const mock = vi.hoisted(() => ({ listeners: new Map<string, (value: any) => void>(), send: vi.fn(), dispose: vi.fn() }));
vi.mock("@/services/server", () => ({
  localServer: { getAddress: () => "ws://test" },
  interfaceProtocol: Object.fromEntries([
    ...["Status", "Changed", "Snapshot", "Context", "Error", "ContextDisposed", "Agent"].map(name => [`on${name}`, (listener: (value: unknown) => void) => { mock.listeners.set(name, listener); return () => mock.listeners.delete(name); }]),
    ["requestStatus", vi.fn()], ["requestSnapshot", mock.send], ["resolveContext", mock.send], ["disposeContext", mock.dispose],
  ]),
}));
import { initializeProjectInterface } from "./projectInterfaceService";

const snapshot: ProjectInterfaceSnapshot = { projectId: "p", revision: "r1", language: "zh_cn", entryPath: "/p/interface.json", interfaceRoot: "/p", projectRoot: "/p", document: { controller: [{ name: "c" }], resource: [{ name: "r" }], task: [{ name: "a", entry: "A" }, { name: "b", entry: "B" }] } };
function load() {
  mock.listeners.get("Status")!({ state: "ready", projectId: "p", revision: "r1" });
  const requestId = mock.send.mock.calls.at(-1)![1];
  mock.listeners.get("Snapshot")!({ requestId, snapshot });
}

describe("shared PI lifecycle", () => {
  beforeEach(() => {
    localStorage.clear(); mock.send.mockReset().mockReturnValue(true); mock.dispose.mockReset();
    useWSStore.setState({ connected: true });
    store.setState({ address: "", preferences: emptyPreferences(), debugTaskName: "", snapshot: undefined, status: undefined, generation: 0, contexts: emptyContexts() });
  });
  it("keeps home selection out of ordinary debug context and discards stale responses", () => {
    const stop = initializeProjectInterface(); load();
    const first = store.getState().contexts.home.requestId;
    expect(store.getState().preferences.taskName).toBe("a");
    expect(store.getState().debugTaskName).toBe("");
    store.getState().selectTask("b");
    mock.listeners.get("Context")!({ requestId: first, contextId: "obsolete", revision: "r1" });
    expect(mock.dispose).toHaveBeenCalledWith("obsolete");
    expect(store.getState().contexts.home.plan).toBeUndefined();
    const requestId = store.getState().contexts.home.requestId;
    const plan = { requestId, contextId: "latest", taskName: "b", revision: "r1" } as ProjectInterfaceRuntimePlan;
    mock.listeners.get("Context")!(plan);
    expect(store.getState().contexts.home.plan).toEqual(plan);
    expect(store.getState().debugTaskName).toBe("");
    stop(); expect(mock.listeners.size).toBe(0);
  });
  it("exposes invalid form results and invalidates pending work on change/disconnect", () => {
    const stop = initializeProjectInterface(); load();
    const requestId = store.getState().contexts.home.requestId;
    mock.listeners.get("Context")!({ requestId, contextId: "", revision: "r1", optionGroups: [{ scope: "task", nodes: [{ name: "count" }] }], diagnostics: [{ severity: "error", message: "请输入数字" }] });
    expect(store.getState().contexts.home.error).toBe("请输入数字");
    expect(store.getState().contexts.home.plan?.optionGroups).toHaveLength(1);
    const generation = store.getState().generation;
    mock.listeners.get("Changed")!({ status: { state: "invalid", revision: "r2" } });
    expect(store.getState().generation).toBeGreaterThan(generation);
    expect(store.getState().contexts.home.plan).toBeUndefined();
    useWSStore.getState().setConnected(false);
    expect(store.getState().snapshot).toBeUndefined();
    stop();
  });
  it("retains the previous context until a replacement is accepted", () => {
    const stop = initializeProjectInterface(); load();
    mock.listeners.get("Context")!({ requestId: store.getState().contexts.home.requestId, contextId: "previous", revision: "r1" });
    store.getState().selectTask("b");
    expect(mock.dispose).not.toHaveBeenCalledWith("previous");
    expect(store.getState().contexts.home.plan?.contextId).toBe("");
    mock.listeners.get("Context")!({ requestId: store.getState().contexts.home.requestId, contextId: "replacement", revision: "r1" });
    expect(mock.dispose).toHaveBeenCalledWith("previous");
    expect(store.getState().contexts.home.plan?.contextId).toBe("replacement");
    stop();
  });
});
