import { afterEach, expect, it, vi } from "vitest";
import { useRecorderStore } from "./store";
import { newStep, type RecorderStep, type RecorderResult } from "./types";
const io = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@/services/server", () => ({ recorderProtocol: { run: io.run } }));
import { chooseOCR, enqueueSuggestion } from "./suggestions";
function captured(): RecorderStep {
  const s = newStep();
  s.frame = {
    width: 800,
    height: 600,
    image: "before",
    controllerId: "device",
  };
  s.capturePoint = { x: 100, y: 100 };
  s.suggestion = "pending";
  s.config.recognition = "TemplateMatch";
  s.config.templateImage = "template";
  return s;
}
const response: RecorderResult = {
  request_id: "r",
  success: true,
  hit: true,
  boxes: [
    { x: 85, y: 90, width: 30, height: 20, score: 0.95, text: "精选(1)" },
  ],
};
afterEach(() => {
  useRecorderStore.getState().reset();
  vi.clearAllMocks();
});
it("prefers nearby reliable text and escapes regex, but keeps symbols and distant text as templates", () => {
  const s = captured();
  const patch = chooseOCR(s, response)!;
  expect(patch.recognition).toBe("OCR");
  expect(patch.expected).toBe("精选\\(1\\)");
  expect(patch.offset).toEqual([0, 0, 0, 0]);
  for (const overrides of [
    { text: "..." },
    { text: "精选", score: 0.2 },
    { x: 300 },
  ])
    expect(
      chooseOCR(s, {
        ...response,
        boxes: [{ ...response.boxes[0], ...overrides }],
      }),
    ).toBeUndefined();
});
it("analyzes the original frame without a device action and updates a saved step", async () => {
  const state = useRecorderStore.getState();
  const step = captured();
  state.appendCapture(step);
  io.run.mockResolvedValue(response);
  await enqueueSuggestion(step, state.sessionId);
  expect(io.run.mock.calls[0][0]).toMatchObject({
    mode: "suggest",
    controller_id: "",
    base_image: "before",
    step: { action: "DoNothing", recognition: "OCR" },
  });
  expect(useRecorderStore.getState().steps[0].config.expected).toBe(
    "精选\\(1\\)",
  );
  expect(useRecorderStore.getState().steps[0].suggestion).toBe("ocr");
  expect(useRecorderStore.getState().steps[0].result).toBeUndefined();
});
it("never overwrites manual edits, skipped analysis, or a reset session with a late result", async () => {
  for (const change of [
    () => useRecorderStore.getState().edit({ expected: "手动" }),
    () => useRecorderStore.getState().skipSuggestions(),
    () => useRecorderStore.getState().reset(),
  ]) {
    const state = useRecorderStore.getState();
    const step = captured();
    state.appendCapture(step);
    let resolve!: (r: RecorderResult) => void;
    io.run.mockImplementation(
      () =>
        new Promise<RecorderResult>((r) => {
          resolve = r;
        }),
    );
    const pending = enqueueSuggestion(step, state.sessionId);
    await Promise.resolve();
    change();
    resolve(response);
    await pending;
    expect(useRecorderStore.getState().current.config.expected).not.toBe(
      "精选\\(1\\)",
    );
    expect(
      useRecorderStore.getState().steps.some((s) => s.suggestion === "ocr"),
    ).toBe(false);
    useRecorderStore.getState().reset();
  }
});

it("keeps icon-like OCR and embedded icon mixtures as templates even at high confidence", () => {
  for (const text of ["≈0", "0", "O", "＋", "下⊕载"]) {
    expect(
      chooseOCR(captured(), {
        ...response,
        boxes: [{ ...response.boxes[0], text, score: 0.999 }],
      }),
    ).toBeUndefined();
  }
  for (const text of [
    "下载",
    "精选",
    "桌面",
    "Save (1)",
    "100%",
    "设置/帮助",
  ]) {
    expect(
      chooseOCR(captured(), {
        ...response,
        boxes: [{ ...response.boxes[0], text, score: 0.95 }],
      })?.name,
    ).toBe(text);
  }
});
it("requires strong confidence and a click on the text rather than a nearby icon", () => {
  for (const box of [
    { ...response.boxes[0], score: 0.89 },
    { ...response.boxes[0], x: 106 },
    { ...response.boxes[0], y: 106 },
  ]) {
    expect(
      chooseOCR(captured(), { ...response, boxes: [box] }),
    ).toBeUndefined();
  }
});

it("removes edge icon noise while retaining literal label matching", () => {
  for (const [text, label, expected] of [
    ["④下载", "下载", "下载"],
    ["⊕文件夹", "文件夹", "文件夹"],
    [" ④ 下载 ↓ ", "下载", "下载"],
    ["↓Save (1)", "Save (1)", "Save \\(1\\)"],
    ["下载④", "下载", "下载"],
  ]) {
    const patch = chooseOCR(captured(), {
      ...response,
      boxes: [{ ...response.boxes[0], text }],
    });
    expect(patch).toMatchObject({ recognition: "OCR", name: label, expected });
    expect(new RegExp(patch!.expected!).test(text)).toBe(true);
  }
});
