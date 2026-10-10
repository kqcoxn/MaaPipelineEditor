import {
  newStep,
  type RecorderFrame,
  type RecorderStep,
  type Rect,
} from "./types";
import { findElementRects } from "./segmentation";
import { cropTemplate } from "./geometry";

export function candidateRect(
  x: number,
  y: number,
  width: number,
  height: number,
): Rect {
  const w = Math.min(96, width),
    h = Math.min(64, height);
  return [
    Math.max(0, Math.min(width - w, x - Math.floor(w / 2))),
    Math.max(0, Math.min(height - h, y - Math.floor(h / 2))),
    w,
    h,
  ];
}
export function createCapture(
  frame: RecorderFrame,
  image: HTMLImageElement,
  x: number,
  y: number,
  index: number,
): RecorderStep {
  const step = newStep();
  step.frame = frame;
  step.capturePoint = { x, y };
  step.capture = { status: "pending" };
  step.config = {
    ...step.config,
    name: `点击_${index + 1}`,
    recognition: "DirectHit",
    targetMode: "fixed",
    target: [x, y, 1, 1],
  };
  try {
    let elements: Rect[] = [];
    try {
      elements = findElementRects(image, x, y, frame.width, frame.height);
    } catch {
      /* Retain the neighbourhood fallback if pixels cannot be read. */
    }
    const areas = [...elements, candidateRect(x, y, frame.width, frame.height)];
    step.templateCandidates = areas.map((rect, i) => ({
      rect,
      image: cropTemplate(image, rect),
      label: i < elements.length ? `元素候选 ${i + 1}` : "点击附近",
    }));
    const { rect: area, image: templateImage } = step.templateCandidates[0];
    if (!templateImage.startsWith("data:image/png;base64,")) return step;
    // Use the recognized element as the click target.
    step.config = {
      ...step.config,
      recognition: "TemplateMatch",
      templateImage,
      templateRect: area,
      threshold: 0.7,
      targetMode: "recognition",
      offset: [0, 0, 0, 0],
    };
  } catch {
    /* Cropping is best effort; retain an explicit coordinate draft. */
  }
  return step;
}
