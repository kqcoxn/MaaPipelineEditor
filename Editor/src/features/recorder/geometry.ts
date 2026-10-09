import type { Rect } from "./types";
export function imagePoint(
  clientX: number,
  clientY: number,
  bounds: { left: number; top: number; width: number; height: number },
  width: number,
  height: number,
) {
  return {
    x: Math.max(
      0,
      Math.min(
        width - 1,
        Math.round(((clientX - bounds.left) * width) / bounds.width),
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        height - 1,
        Math.round(((clientY - bounds.top) * height) / bounds.height),
      ),
    ),
  };
}
export function selectionRect(
  start: { x: number; y: number },
  end: { x: number; y: number },
): Rect {
  return [
    Math.min(start.x, end.x),
    Math.min(start.y, end.y),
    Math.abs(end.x - start.x) + 1,
    Math.abs(end.y - start.y) + 1,
  ];
}
export function cropTemplate(image: HTMLImageElement, rect: Rect): string {
  const canvas = document.createElement("canvas");
  canvas.width = rect[2];
  canvas.height = rect[3];
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法裁剪模板");
  context.drawImage(image, ...rect, 0, 0, rect[2], rect[3]);
  return canvas.toDataURL("image/png");
}
