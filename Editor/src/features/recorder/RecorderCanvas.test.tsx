import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RecorderCanvas } from "./RecorderCanvas";
import { useRecorderStore } from "./store";
import { useCanvasViewport } from "@/hooks/useCanvasViewport";
import { act, renderHook } from "@testing-library/react";

beforeEach(() => {
  useRecorderStore.getState().reset();
  useRecorderStore.getState().setDetailsOpen(true);
  useRecorderStore.getState().setBusy(false);
  useRecorderStore.getState().setFrame({
    image: "data:image/png;base64,frame",
    width: 800,
    height: 600,
    controllerId: "device",
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("commits a zoomed ROI selection without changing template or target", () => {
  useRecorderStore
    .getState()
    .edit({ templateRect: [3, 4, 10, 20], target: [50, 60, 1, 1] });
  render(<RecorderCanvas />);
  Object.defineProperty(screen.getByAltText("当前步骤底图"), "complete", {
    value: true,
    configurable: true,
  });
  const canvas = screen.getByLabelText("框选区域和点击位置");
  Object.defineProperty(canvas, "setPointerCapture", {
    value: vi.fn(),
    configurable: true,
  });
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 100,
    top: 50,
    width: 400,
    height: 300,
  } as DOMRect);
  fireEvent.pointerDown(canvas, {
    button: 0,
    pointerId: 1,
    clientX: 110,
    clientY: 60,
  });
  fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 150, clientY: 90 });
  fireEvent.pointerUp(canvas, {
    button: 0,
    pointerId: 1,
    clientX: 150,
    clientY: 90,
  });
  const config = useRecorderStore.getState().current.config;
  expect(config.roi).toEqual([20, 20, 81, 61]);
  expect(config.templateRect).toEqual([3, 4, 10, 20]);
  expect(config.target).toEqual([50, 60, 1, 1]);
  expect(useRecorderStore.getState().steps).toEqual([]);
});
it("does not steal spaces from OCR text inputs", () => {
  const { result } = renderHook(() =>
    useCanvasViewport({ open: true, screenshot: null }),
  );
  const input = document.createElement("input");
  document.body.appendChild(input);
  const typing = new KeyboardEvent("keydown", {
    code: "Space",
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    input.dispatchEvent(typing);
  });
  expect(typing.defaultPrevented).toBe(false);
  expect(result.current.isSpacePressed).toBe(false);
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "Space", cancelable: true }),
    );
  });
  expect(result.current.isSpacePressed).toBe(true);
  input.remove();
});

it("clicks on the displayed frame and keeps that frame stable during a gesture", () => {
  const original = useRecorderStore.getState().current.frame!;
  useRecorderStore.getState().setDetailsOpen(false);
  useRecorderStore.getState().setLiveFrame(original);
  const click = vi.fn();
  render(<RecorderCanvas onClick={click} />);
  Object.defineProperty(screen.getByAltText("当前步骤底图"), "complete", {
    value: true,
    configurable: true,
  });
  const canvas = screen.getByLabelText("框选区域和点击位置");
  Object.defineProperty(canvas, "setPointerCapture", {
    value: vi.fn(),
    configurable: true,
  });
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 100,
    top: 50,
    width: 400,
    height: 300,
  } as DOMRect);
  fireEvent.pointerDown(canvas, {
    button: 0,
    pointerId: 1,
    clientX: 110,
    clientY: 60,
  });
  act(() =>
    useRecorderStore
      .getState()
      .setLiveFrame({ ...original, image: "next", width: 1600 }),
  );
  expect(screen.getByAltText("当前步骤底图").getAttribute("src")).toBe(
    original.image,
  );
  fireEvent.pointerUp(canvas, {
    button: 0,
    pointerId: 1,
    clientX: 110,
    clientY: 60,
  });
  expect(click).toHaveBeenCalledWith(
    original,
    expect.any(HTMLImageElement),
    20,
    20,
  );
  expect(screen.getByAltText("当前步骤底图").getAttribute("src")).toBe("next");
});
