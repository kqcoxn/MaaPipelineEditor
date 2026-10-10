import { beforeEach, describe, expect, it } from "vitest";
import { useRecorderStore } from "./store";
import { buildRecorderGraph } from "./graph";
import { escapeOCRText, newStep } from "./types";
import { imagePoint, selectionRect } from "./geometry";
import { useFlowStore } from "@/stores/flow";

beforeEach(() => {
  useRecorderStore.getState().reset();
  useRecorderStore.getState().setBusy(false);
});
describe("Recorder review", () => {
  it("retains capture order, exits deleted-step review, and clears on close", () => {
    const state = useRecorderStore.getState();
    const first = newStep();
    const second = newStep();
    state.appendCapture(first);
    state.appendCapture(second);
    state.select(first.id);
    state.setDetailsOpen(true);
    expect(useRecorderStore.getState().steps.map((s) => s.id)).toEqual([first.id, second.id]);
    expect(useRecorderStore.getState().current.id).toBe(first.id);
    state.remove(first.id);
    expect(useRecorderStore.getState().steps).toEqual([second]);
    expect(useRecorderStore.getState().detailsOpen).toBe(false);
    expect(useRecorderStore.getState().recording).toBe(false);
    state.setOpen(false);
    expect(useRecorderStore.getState().steps).toEqual([]);
  });
});
it("maps zoomed/panned pointer positions into image coordinates and clamps selections", () => {
  expect(
    imagePoint(
      150,
      95,
      { left: 100, top: 70, width: 200, height: 100 },
      800,
      400,
    ),
  ).toEqual({ x: 200, y: 100 });
  expect(
    imagePoint(
      -1,
      500,
      { left: 100, top: 70, width: 200, height: 100 },
      800,
      400,
    ),
  ).toEqual({ x: 0, y: 399 });
  expect(selectionRect({ x: 10, y: 20 }, { x: 2, y: 5 })).toEqual([
    2, 5, 9, 16,
  ]);
  expect(escapeOCRText("开始+(1)")).toBe("开始\\+\\(1\\)");
});
it("generates real nodes with no timing metadata, collision-free IDs/names and one undo", async () => {
  const ocr = newStep();
  ocr.config.expected = "开始";
  ocr.config.name = "开始";
  const template = newStep();
  template.config = {
    ...template.config,
    name: "开始",
    recognition: "TemplateMatch",
    templateImage: "image",
    roi: [2, 3, 40, 50],
    threshold: 0.7,
  };
  const direct = newStep();
  direct.config = {
    ...direct.config,
    recognition: "DirectHit",
    targetMode: "fixed",
    target: [20, 30, 1, 1],
  };
  const existing = buildRecorderGraph([ocr], {}, [], []).nodes;
  const result = buildRecorderGraph(
    [ocr, template, direct],
    { [template.id]: "recorder/session/button.png" },
    existing,
    [],
  );
  expect(new Set([...existing, ...result.nodes].map((n) => n.id)).size).toBe(4);
  expect(result.nodes.map((n) => n.data.label)).toEqual([
    "开始_2",
    "开始_3",
    "录制步骤_3",
  ]);
  expect(result.nodes[0].data.recognition.param).toEqual({
    expected: ["开始"],
  });
  expect(result.nodes[1].data.recognition.param).toEqual({
    roi: [2, 3, 40, 50],
    template: ["recorder/session/button.png"],
  });
  expect(
    result.nodes.every((n) => !("target_offset" in n.data.action.param)),
  ).toBe(true);
  ocr.config.offset = [10, 5, 0, 0];
  expect(
    buildRecorderGraph([ocr], {}, [], []).nodes[0].data.action.param.target_offset,
  ).toEqual([10, 5, 0, 0]);
  expect(result.nodes[0].data.action.param).not.toHaveProperty("target");
  expect(result.nodes[1].data.action.param).not.toHaveProperty("target");
  expect(result.nodes[2].data.action.param.target).toEqual([20, 30, 1, 1]);
  expect(
    result.nodes.every((n) => Object.keys(n.data.others).length === 0),
  ).toBe(true);
  expect(result.edges.map((e) => [e.source, e.target])).toEqual([
    [result.nodes[0].id, result.nodes[1].id],
    [result.nodes[1].id, result.nodes[2].id],
  ]);
  const flow = useFlowStore.getState();
  flow.replace(existing, [], { isFitView: false, skipHistory: true });
  flow.initHistory(existing, []);
  flow.replace([...existing, ...result.nodes], result.edges, {
    isFitView: false,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  flow.undo();
  expect(useFlowStore.getState().nodes.map((n) => n.id)).toEqual(
    existing.map((n) => n.id),
  );
  expect(useFlowStore.getState().edges).toEqual([]);
  expect(() => buildRecorderGraph([template], {}, [], [])).toThrow(
    "模板尚未保存",
  );
});

it("omits default recognition parameters while retaining non-default thresholds and ROI", () => {
  const ocr = newStep();
  ocr.config.expected = "开始";
  ocr.config.threshold = 0.7;
  ocr.config.roi = [10, 20, 100, 40];
  const template = newStep();
  template.config = { ...template.config, recognition: "TemplateMatch", templateImage: "image", threshold: 0.7 };
  const paths = { [template.id]: "button.png" };
  const generated = buildRecorderGraph([ocr, template], paths, [], []).nodes;
  expect(generated[0].data.recognition.param).toEqual({ expected: ["开始"], roi: [10, 20, 100, 40], threshold: 0.7 });
  expect(generated[1].data.recognition.param).toEqual({ template: ["button.png"] });
  expect(generated[1].data.action.param).toEqual({});
  template.config.threshold = 0.9;
  expect(buildRecorderGraph([template], paths, [], []).nodes[0].data.recognition.param).toEqual({ template: ["button.png"], threshold: [0.9] });
});
