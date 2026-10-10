import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useRecorderStore } from "./store";
import { useMFWStore } from "@/stores/connection/mfwStore";
import { newStep } from "./types";

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
  const step = newStep();
  step.config.expected = "开始";
  step.frame = { image: "before", width: 800, height: 600, controllerId: "device" };
  useRecorderStore.getState().appendCapture(step);
});
afterEach(() => {
  cleanup();
  useRecorderStore.getState().reset();
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

it("keeps recorded steps and the canvas intact when template saving fails", async () => {
  const { useFlowStore } = await import("@/stores/flow");
  const step = newStep();
  step.config.recognition = "TemplateMatch";
  step.config.templateImage = "template";
  useRecorderStore.setState({ steps: [step], current: step, resourcePath: "resource" });
  const before = useFlowStore.getState().nodes;
  io.saveAssets.mockResolvedValue({ success: false, error: "写入失败" });
  const { result } = renderHook(() => useRecorderActions());
  await act(() => result.current.generate());
  expect(useRecorderStore.getState().steps).toEqual([step]);
  expect(useFlowStore.getState().nodes).toBe(before);
  expect(useRecorderStore.getState().busy).toBe(false);
});
