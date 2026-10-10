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
// Trim unsupported edge symbols, but never join text across an embedded icon.
// Keep ordinary punctuation intact so labels and regex escaping retain meaning.
const LABEL_CHARACTER =
  /[\p{L}\p{M}\p{Nd}\s.,:;!?，。：；！？、()（）[\]【】「」『』“”‘’'"_+%％/-]/u;
function reliableLabel(text: string): string | undefined {
  const characters = Array.from(text.trim());
  while (characters.length && !LABEL_CHARACTER.test(characters[0]))
    characters.shift();
  while (
    characters.length &&
    !LABEL_CHARACTER.test(characters[characters.length - 1])
  )
    characters.pop();
  const label = characters.join("").trim();
  if (
    (label.match(/[\p{L}\p{Nd}]/gu) ?? []).length >= 2 &&
    characters.every((character) => LABEL_CHARACTER.test(character))
  )
    return label;
}

export function chooseOCR(
  step: RecorderStep,
  result: RecorderResult,
): Partial<RecorderConfig> | undefined {
  if (!result.success || !step.frame || !step.capturePoint) return;
  const { x, y } = step.capturePoint;
  const nearby = result.boxes
    .map((box) => ({ ...box, label: reliableLabel(box.text ?? "") }))
    .filter((b) => {
      if (
        !b.text ||
        !b.label ||
        !Number.isFinite(b.score) ||
        b.score < 0.9 ||
        b.width <= 0 ||
        b.height <= 0
      )
        return false;
      return (
        x >= b.x - 2 &&
        x <= b.x + b.width + 2 &&
        y >= b.y - 2 &&
        y <= b.y + b.height + 2
      );
    })
    .sort(
      (a, b) =>
        Math.hypot(x - a.x - a.width / 2, y - a.y - a.height / 2) -
        Math.hypot(x - b.x - b.width / 2, y - b.y - b.height / 2),
    );
  const box = nearby[0];
  if (!box?.label) return;
  return {
    recognition: "OCR",
    name: box.label,
    expected: escapeOCRText(box.label),
    threshold: 0.7,
    roi: suggestionROI(step),
    targetMode: "recognition",
    offset: [0, 0, 0, 0],
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
