import { useCallback, useEffect, useRef, type RefObject } from "react";

export type CanvasMotionReason =
  | "node-drag"
  | "selection-drag"
  | "viewport"
  | "connection"
  | "edge-control"
  | "page-hidden";

interface FrameScheduler {
  request: (callback: FrameRequestCallback) => number;
  cancel: (frameId: number) => void;
}

export interface CanvasMotionController {
  begin: (reason: CanvasMotionReason) => void;
  end: (reason: CanvasMotionReason) => void;
  destroy: () => void;
}

const updateMotionAttribute = (
  element: HTMLElement,
  activeReasons: ReadonlySet<CanvasMotionReason>,
  pauseMotion: boolean,
) => {
  element.dataset.canvasMotion = pauseMotion && activeReasons.size > 0 ? "paused" : "idle";
  element.dataset.canvasDragging = String(
    activeReasons.has("node-drag") ||
      activeReasons.has("selection-drag") ||
      activeReasons.has("viewport"),
  );
};

export const createCanvasMotionController = (
  element: HTMLElement,
  scheduler: FrameScheduler = {
    request: window.requestAnimationFrame.bind(window),
    cancel: window.cancelAnimationFrame.bind(window),
  },
  pauseMotion = true,
): CanvasMotionController => {
  const activeReasons = new Set<CanvasMotionReason>();
  const pendingFrames = new Map<CanvasMotionReason, number>();

  const cancelPendingFrame = (reason: CanvasMotionReason) => {
    const frameId = pendingFrames.get(reason);
    if (frameId === undefined) return;
    scheduler.cancel(frameId);
    pendingFrames.delete(reason);
  };

  const begin = (reason: CanvasMotionReason) => {
    cancelPendingFrame(reason);
    activeReasons.add(reason);
    updateMotionAttribute(element, activeReasons, pauseMotion);
  };

  const end = (reason: CanvasMotionReason) => {
    cancelPendingFrame(reason);
    if (!activeReasons.has(reason)) return;

    const frameId = scheduler.request(() => {
      pendingFrames.delete(reason);
      activeReasons.delete(reason);
      updateMotionAttribute(element, activeReasons, pauseMotion);
    });
    pendingFrames.set(reason, frameId);
  };

  const destroy = () => {
    pendingFrames.forEach((frameId) => scheduler.cancel(frameId));
    pendingFrames.clear();
    activeReasons.clear();
    updateMotionAttribute(element, activeReasons, pauseMotion);
  };

  updateMotionAttribute(element, activeReasons, pauseMotion);
  return { begin, end, destroy };
};

export const useCanvasMotionPause = (
  rootRef: RefObject<HTMLElement | null>,
  enabled = true,
  hideEdgesOnDrag = false,
) => {
  const controllerRef = useRef<CanvasMotionController | null>(null);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    if (!enabled && !hideEdgesOnDrag) {
      element.dataset.canvasMotion = "idle";
      element.dataset.canvasDragging = "false";
      controllerRef.current = null;
      return;
    }

    const controller = createCanvasMotionController(element, undefined, enabled);
    controllerRef.current = controller;

    const updatePageVisibility = () => {
      if (document.hidden) {
        controller.begin("page-hidden");
      } else {
        controller.end("page-hidden");
      }
    };

    updatePageVisibility();
    document.addEventListener("visibilitychange", updatePageVisibility);

    return () => {
      document.removeEventListener("visibilitychange", updatePageVisibility);
      controller.destroy();
      controllerRef.current = null;
    };
  }, [enabled, hideEdgesOnDrag, rootRef]);

  const beginCanvasMotionPause = useCallback((reason: CanvasMotionReason) => {
    controllerRef.current?.begin(reason);
  }, []);

  const endCanvasMotionPause = useCallback((reason: CanvasMotionReason) => {
    controllerRef.current?.end(reason);
  }, []);

  return { beginCanvasMotionPause, endCanvasMotionPause };
};
