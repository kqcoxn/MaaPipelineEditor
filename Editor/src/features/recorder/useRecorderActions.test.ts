import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useRecorderStore } from "./store";
import { useMFWStore } from "@/stores/connection/mfwStore";
import type { RecorderResult } from "./types";

const io = vi.hoisted(() => ({
  run: vi.fn(),
  screenshot: vi.fn(),
  saveAssets: vi.fn(),
}));
vi.mock("@/services/server", () => ({
  recorderProtocol: { run: io.run, saveAssets: io.saveAssets },
  mfwProtocol: { requestScreencap: io.screenshot },
  resourceProtocol: { requestRefreshResources: vi.fn() },
}));
vi.mock("@/utils/ui/antdAppApi", () => ({
  message: {
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));
import { useRecorderActions } from "./useRecorderActions";

beforeEach(() => {
  vi.clearAllMocks();
  useRecorderStore.getState().reset();
  useRecorderStore.getState().setBusy(false);
  useMFWStore.setState({
    controllerId: "device",
    connectionStatus: "connected",
  });
  useRecorderStore.getState().edit({ expected: "开始" });
  useRecorderStore.getState().setFrame({
    image: "before",
    width: 800,
    height: 600,
    controllerId: "device",
  });
});
afterEach(() => {
  cleanup();
  useRecorderStore.getState().reset();
});
it("saving sends no device request; execution refreshes the frame without recording", async () => {
  const { result } = renderHook(() => useRecorderActions());
  act(() => {
    expect(result.current.save()).toBe(true);
  });
  expect(io.run).not.toHaveBeenCalled();
  expect(io.screenshot).not.toHaveBeenCalled();
  act(() => useRecorderStore.getState().select());
  act(() => useRecorderStore.getState().edit({ expected: "返回" }));
  io.run.mockResolvedValue({
    request_id: "r",
    success: true,
    hit: true,
    action_success: true,
    boxes: [],
  });
  io.screenshot.mockResolvedValue({
    success: true,
    image: "after",
    width: 800,
    height: 600,
  });
  await act(() => result.current.run("execute"));
  expect(useRecorderStore.getState().steps).toHaveLength(1);
  expect(useRecorderStore.getState().steps[0].config.expected).toBe("开始");
  expect(useRecorderStore.getState().current.frame?.image).toBe("after");
  expect(useRecorderStore.getState().current.result?.action_success).toBe(true);
});
it("ignores a response when the selected step changes while the request is pending", async () => {
  let resolve!: (r: RecorderResult) => void;
  io.run.mockImplementation(
    () =>
      new Promise<RecorderResult>((r) => {
        resolve = r;
      }),
  );
  const { result } = renderHook(() => useRecorderActions());
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.run("preview");
  });
  act(() => useRecorderStore.getState().select());
  await act(async () => {
    resolve({ request_id: "r", success: true, hit: true, boxes: [] });
    await pending;
  });
  expect(useRecorderStore.getState().current.result).toBeUndefined();
  expect(useRecorderStore.getState().busy).toBe(false);
  expect(io.screenshot).not.toHaveBeenCalled();
});

it("generates a separate laid-out chain and undo preserves earlier canvas edits", async () => {
  const { useFlowStore } = await import("@/stores/flow");
  const { buildRecorderGraph } = await import("./graph");
  const existing = buildRecorderGraph(
    [useRecorderStore.getState().current],
    {},
    [],
    [],
  ).nodes;
  const flow = useFlowStore.getState();
  flow.replace([], [], { isFitView: false, skipHistory: true });
  flow.initHistory([], []);
  // Simulate an earlier edit still awaiting its debounced history checkpoint.
  flow.replace(existing, [], { isFitView: false, skipHistory: true });
  useRecorderStore.getState().save();
  const { result } = renderHook(() => useRecorderActions());
  await act(() => result.current.generate());
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(useFlowStore.getState().nodes).toHaveLength(2);
  expect(useFlowStore.getState().selectedNodes).toHaveLength(1);
  expect(useFlowStore.getState().edges).toHaveLength(0);
  expect(useRecorderStore.getState().steps).toEqual([]);
  expect(useFlowStore.getState().undo()).toBe(true);
  expect(useFlowStore.getState().nodes.map((n) => n.id)).toEqual(
    existing.map((n) => n.id),
  );
});
