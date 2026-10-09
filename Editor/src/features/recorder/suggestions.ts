import { recorderProtocol } from "@/services/server";
import { useRecorderStore } from "./store";
import {
  escapeOCRText,
  type RecorderConfig,
  type RecorderStep,
  type RecorderResult,
  type Rect,
} from "./types";

export function suggestionROI(step: RecorderStep): Rect {
  const { x, y } = step.capturePoint!;
  const frame = step.frame!;
  const w = Math.min(320, frame.width),
    h = Math.min(160, frame.height);
  return [
    Math.max(0, Math.min(frame.width - w, x - Math.floor(w / 2))),
    Math.max(0, Math.min(frame.height - h, y - Math.floor(h / 2))),
    w,
    h,
  ];
}
export function chooseOCR(
  step: RecorderStep,
  result: RecorderResult,
): Partial<RecorderConfig> | undefined {
  if (!result.success || !step.frame || !step.capturePoint) return;
  const { x, y } = step.capturePoint;
  const nearby = result.boxes
    .filter((b) => {
      if (
        !b.text ||
        !/[\p{L}\p{N}]/u.test(b.text) ||
        !Number.isFinite(b.score) ||
        b.score < 0.7 ||
        b.width <= 0 ||
        b.height <= 0
      )
        return false;
      return (
        x >= b.x - 8 &&
        x <= b.x + b.width + 8 &&
        y >= b.y - 8 &&
        y <= b.y + b.height + 8
      );
    })
    .sort(
      (a, b) =>
        Math.hypot(x - a.x - a.width / 2, y - a.y - a.height / 2) -
        Math.hypot(x - b.x - b.width / 2, y - b.y - b.height / 2),
    );
  const box = nearby[0];
  if (!box) return;
  return {
    recognition: "OCR",
    name: box.text.trim(),
    expected: escapeOCRText(box.text.trim()),
    threshold: 0.7,
    roi: suggestionROI(step),
    targetMode: "recognition",
    offset: [x - box.x, y - box.y, 1 - box.width, 1 - box.height],
  };
}
// One bounded request at a time. Closing the workbench retains analysis;
// resetting/importing, skipping, or editing a step invalidates its automatic patch.
let queue: Promise<void> = Promise.resolve();
export function enqueueSuggestion(
  step: RecorderStep,
  sessionId: string,
): Promise<void> {
  queue = queue.then(async () => {
    const state = useRecorderStore.getState();
    const saved = state.steps.find((s) => s.id === step.id);
    if (state.sessionId !== sessionId || saved?.suggestion !== "pending")
      return;
    if (
      saved.version !== step.version ||
      (state.current.id === step.id && state.dirty)
    ) {
      state.finishSuggestion(sessionId, step.id, step.version);
      return;
    }
    try {
      const response = await recorderProtocol.run({
        mode: "suggest",
        controller_id: "",
        base_image: step.frame!.image,
        step: {
          recognition: "OCR",
          action: "DoNothing",
          roi: suggestionROI(step),
          expected: "",
          threshold: 0.7,
          target_offset: [0, 0, 0, 0],
        },
      });
      useRecorderStore
        .getState()
        .finishSuggestion(
          sessionId,
          step.id,
          step.version,
          chooseOCR(step, response),
          response.success ? undefined : response.error || "OCR 分析失败",
        );
    } catch (error) {
      useRecorderStore
        .getState()
        .finishSuggestion(
          sessionId,
          step.id,
          step.version,
          undefined,
          String(error),
        );
    }
  });
  return queue;
}
