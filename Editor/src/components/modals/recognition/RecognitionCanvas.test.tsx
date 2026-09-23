import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanvasRenderProps } from "../ScreenshotModalBase";
import { RecognitionCanvas } from "./RecognitionCanvas";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("RecognitionCanvas viewport sizing", () => {
  it("fits again when its container resizes, but preserves zoom when results change", () => {
    let resize: () => void = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { resize = callback; }
      observe = vi.fn();
      disconnect = disconnect;
    });
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => { callback(); return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(), strokeRect: vi.fn(), setLineDash: vi.fn(), fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    const image = new Image();
    image.width = 1280;
    image.height = 720;
    const initializeImage = vi.fn();
    const viewport = {
      imageElement: image, initializeImage,
      containerRef: { current: document.createElement("div") },
      scale: 1, panOffset: { x: 0, y: 0 }, getBaseCursorStyle: () => undefined,
    } as unknown as CanvasRenderProps;
    const { rerender, unmount } = render(<RecognitionCanvas viewport={viewport}
      roi={[0, 0, 0, 0]} boxes={[]} onROIChange={vi.fn()} />);
    expect(initializeImage).toHaveBeenCalledExactlyOnceWith(image);
    rerender(<RecognitionCanvas viewport={viewport} roi={[0, 0, 0, 0]}
      boxes={[{ x: 10, y: 20, width: 50, height: 30, score: 0.9, text: "应用" }]}
      onROIChange={vi.fn()} />);
    expect(initializeImage).toHaveBeenCalledTimes(1);
    resize();
    expect(initializeImage).toHaveBeenCalledTimes(2);
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
