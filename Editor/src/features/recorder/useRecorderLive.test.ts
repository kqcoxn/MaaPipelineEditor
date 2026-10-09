import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useRecorderStore } from "./store";
import { useMFWStore } from "@/stores/connection/mfwStore";
import type { RecorderFrame, RecorderResult } from "./types";
import { candidateRect } from "./capture";
const io = vi.hoisted(() => ({
  click: vi.fn(),
  screenshot: vi.fn(),
  run: vi.fn(),
}));
vi.mock("@/services/server", () => ({
  recorderProtocol: { click: io.click, run: io.run },
  mfwProtocol: { requestScreencap: io.screenshot },
}));
vi.mock("@/utils/ui/antdAppApi", () => ({
  message: { error: vi.fn(), warning: vi.fn() },
}));
import { useRecorderLive } from "./useRecorderLive";
const frame: RecorderFrame = {
  image: "before",
  width: 800,
  height: 600,
  controllerId: "device",
};
beforeEach(() => {
  vi.clearAllMocks();
  io.run.mockResolvedValue({ success: true, hit: false, boxes: [] });
  useRecorderStore.getState().reset();
  useRecorderStore.getState().setBusy(false);
  useMFWStore.setState({
    controllerId: "device",
    connectionStatus: "connected",
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/png;base64,candidate",
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useRecorderStore.getState().reset();
});
it("sends input immediately and records an unverified candidate from the pre-click frame", async () => {
  let finish!: (result: RecorderResult) => void;
  io.click.mockImplementation(
    () =>
      new Promise<RecorderResult>((resolve) => {
        finish = resolve;
      }),
  );
  useRecorderStore.getState().setRecording(true);
  const { result } = renderHook(() => useRecorderLive());
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.click(frame, new Image(), 790, 590);
  });
  expect(io.screenshot).not.toHaveBeenCalled();
  expect(io.click).toHaveBeenCalledWith({
    controller_id: "device",
    x: 790,
    y: 590,
    width: 800,
    height: 600,
  });
  const step = useRecorderStore.getState().steps[0];
  expect(step.frame).toEqual(frame);
  expect(step.config.recognition).toBe("TemplateMatch");
  expect(step.config.roi).toEqual([0, 0, 0, 0]);
  const [x, y, w, h] = step.config.templateRect!;
  expect(x + step.config.offset[0]).toBe(790);
  expect(y + step.config.offset[1]).toBe(590);
  expect(w + step.config.offset[2]).toBe(1);
  expect(h + step.config.offset[3]).toBe(1);
  expect(step.capture?.status).toBe("pending");
  expect(step.result).toBeUndefined();
  // Late operation feedback must never overwrite a user's field correction.
  act(() => useRecorderStore.getState().edit({ expected: "手动修改" }));
  await act(async () => {
    finish({ request_id: "r", success: true, hit: false, boxes: [] });
    await pending;
  });
  expect(useRecorderStore.getState().steps).toHaveLength(1);
  expect(useRecorderStore.getState().steps[0].capture?.status).toBe("success");
  expect(useRecorderStore.getState().current.config.expected).toBe("手动修改");
  expect(useRecorderStore.getState().steps[0].result).toBeUndefined();
});
it("allows free operation without recording and blocks device input in correction mode", async () => {
  io.click.mockResolvedValue({ success: true });
  const { result } = renderHook(() => useRecorderLive());
  await act(() => result.current.click(frame, new Image(), 10, 20));
  expect(useRecorderStore.getState().steps).toEqual([]);
  expect(io.click).toHaveBeenCalledTimes(1);
  act(() => useRecorderStore.getState().setDetailsOpen(true));
  await act(() => result.current.click(frame, new Image(), 10, 20));
  expect(io.click).toHaveBeenCalledTimes(1);
});
it("retains failed input as failed evidence and falls back to a coordinate draft if cropping fails", async () => {
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => {
    throw new Error("unavailable");
  });
  io.click.mockRejectedValue(new Error("connection lost"));
  useRecorderStore.getState().setRecording(true);
  const { result } = renderHook(() => useRecorderLive());
  await act(() => result.current.click(frame, new Image(), 10, 20));
  const step = useRecorderStore.getState().steps[0];
  expect(step.config.recognition).toBe("DirectHit");
  expect(step.config.target).toEqual([10, 20, 1, 1]);
  expect(step.capture?.status).toBe("unknown");
  expect(io.click).toHaveBeenCalledTimes(1);
  expect(useRecorderStore.getState().busy).toBe(false);
});
it("clamps the candidate rectangle even for a small screen", () => {
  expect(candidateRect(0, 0, 30, 20)).toEqual([0, 0, 30, 20]);
  expect(candidateRect(799, 599, 800, 600)).toEqual([704, 536, 96, 64]);
});

it("drops template-specific offsets when correcting an automatic step to OCR", () => {
  const state = useRecorderStore.getState();
  state.edit({ recognition: "TemplateMatch", offset: [48, 32, -95, -63] });
  state.edit({ recognition: "OCR", expected: "开始" });
  expect(useRecorderStore.getState().current.config.offset).toEqual([
    0, 0, 0, 0,
  ]);
});

it("uses the configured frame cadence, subtracts capture time, and cancels on close", async () => {
  vi.useFakeTimers();
  const { useConfigStore } = await import("@/stores/app/configStore");
  const original = useConfigStore.getState().configs.liveScreenRefreshRate;
  useConfigStore.getState().setConfig("liveScreenRefreshRate", 10);
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  io.screenshot.mockImplementation(
    () =>
      new Promise((resolve) => {
        setTimeout(() => resolve({ success: true, ...frame }), 30);
      }),
  );
  useRecorderStore.getState().setOpen(true);
  try {
    renderHook(() => useRecorderLive());
    expect(io.screenshot).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(99));
    expect(io.screenshot).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(io.screenshot).toHaveBeenCalledTimes(2);
    act(() => useRecorderStore.getState().setOpen(false));
    expect(io.screenshot.mock.calls[1][1].aborted).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(io.screenshot).toHaveBeenCalledTimes(2);
  } finally {
    cleanup();
    useConfigStore.getState().setConfig("liveScreenRefreshRate", original);
    vi.useRealTimers();
  }
});

it("continues sending device input while OCR analysis is pending", async () => {
  let finish!: (result: RecorderResult) => void;
  io.run.mockImplementation(
    () =>
      new Promise<RecorderResult>((resolve) => {
        finish = resolve;
      }),
  );
  io.click.mockResolvedValue({ success: true });
  useRecorderStore.getState().setRecording(true);
  const { result } = renderHook(() => useRecorderLive());
  await act(() => result.current.click(frame, new Image(), 100, 100));
  expect(io.run).toHaveBeenCalledTimes(1);
  expect(useRecorderStore.getState().busy).toBe(false);
  await act(() => result.current.click(frame, new Image(), 150, 100));
  expect(io.click).toHaveBeenCalledTimes(2);
  expect(io.run).toHaveBeenCalledTimes(1);
  expect(useRecorderStore.getState().steps).toHaveLength(2);
  await act(async () => {
    useRecorderStore.getState().skipSuggestions();
    finish({ request_id: "r", success: true, hit: false, boxes: [] });
    await Promise.resolve();
  });
});
