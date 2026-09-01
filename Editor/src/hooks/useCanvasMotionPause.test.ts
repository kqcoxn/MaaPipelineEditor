import { act, renderHook } from "@testing-library/react";

import {
  createCanvasMotionController,
  useCanvasMotionPause,
} from "./useCanvasMotionPause";

describe("createCanvasMotionController", () => {
  const createScheduler = () => {
    let nextFrameId = 1;
    const callbacks = new Map<number, FrameRequestCallback>();
    return {
      scheduler: {
        request: vi.fn((callback: FrameRequestCallback) => {
          const frameId = nextFrameId++;
          callbacks.set(frameId, callback);
          return frameId;
        }),
        cancel: vi.fn((frameId: number) => callbacks.delete(frameId)),
      },
      flush: () => {
        const queuedCallbacks = [...callbacks.values()];
        callbacks.clear();
        queuedCallbacks.forEach((callback) => callback(0));
      },
    };
  };

  test("keeps decorative motion paused until every interaction ends", () => {
    const element = document.createElement("div");
    const { scheduler, flush } = createScheduler();
    const controller = createCanvasMotionController(element, scheduler);

    controller.begin("node-drag");
    controller.begin("viewport");
    expect(element).toHaveAttribute("data-canvas-motion", "paused");

    controller.end("node-drag");
    flush();
    expect(element).toHaveAttribute("data-canvas-motion", "paused");

    controller.end("viewport");
    expect(element).toHaveAttribute("data-canvas-motion", "paused");
    flush();
    expect(element).toHaveAttribute("data-canvas-motion", "idle");
  });

  test("cancels a pending resume when the same interaction restarts", () => {
    const element = document.createElement("div");
    const { scheduler, flush } = createScheduler();
    const controller = createCanvasMotionController(element, scheduler);

    controller.begin("edge-control");
    controller.end("edge-control");
    controller.begin("edge-control");
    flush();

    expect(scheduler.cancel).toHaveBeenCalledTimes(1);
    expect(element).toHaveAttribute("data-canvas-motion", "paused");
  });

  test("cancels queued frames during cleanup", () => {
    const element = document.createElement("div");
    const { scheduler } = createScheduler();
    const controller = createCanvasMotionController(element, scheduler);

    controller.begin("page-hidden");
    controller.end("page-hidden");
    controller.destroy();

    expect(scheduler.cancel).toHaveBeenCalledTimes(1);
  });
});

describe("useCanvasMotionPause", () => {
  test("clears a previous pause state when the feature is disabled", () => {
    const element = document.createElement("div");
    element.dataset.canvasMotion = "paused";
    const rootRef = { current: element };

    const { result, rerender } = renderHook(
      ({ enabled }) => useCanvasMotionPause(rootRef, enabled),
      { initialProps: { enabled: false } },
    );

    expect(element).toHaveAttribute("data-canvas-motion", "idle");
    act(() => result.current.beginCanvasMotionPause("node-drag"));
    expect(element).toHaveAttribute("data-canvas-motion", "idle");

    rerender({ enabled: true });
    act(() => result.current.beginCanvasMotionPause("node-drag"));
    expect(element).toHaveAttribute("data-canvas-motion", "paused");
  });

  test("pauses motion while the page is hidden and resumes on the next frame", () => {
    const element = document.createElement("div");
    const rootRef = { current: element };
    const originalHidden = document.hidden;
    let hidden = false;
    const frameCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hidden,
    });

    const { unmount } = renderHook(() => useCanvasMotionPause(rootRef));
    expect(element).toHaveAttribute("data-canvas-motion", "idle");

    hidden = true;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(element).toHaveAttribute("data-canvas-motion", "paused");

    hidden = false;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(element).toHaveAttribute("data-canvas-motion", "paused");

    act(() => frameCallbacks.shift()?.(0));
    expect(element).toHaveAttribute("data-canvas-motion", "idle");

    unmount();
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: originalHidden,
    });
  });
});
