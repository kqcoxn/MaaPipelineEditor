import { beforeEach, describe, expect, it } from "vitest";
import { useRecorderStore } from "./store";
import { buildRecorderGraph } from "./graph";
import { escapeOCRText, newStep, type RecorderResult } from "./types";
import { imagePoint, selectionRect } from "./geometry";
import { useFlowStore } from "@/stores/flow";

const success: RecorderResult = {
  request_id: "r",
  success: true,
  hit: true,
  boxes: [],
};
beforeEach(() => {
  useRecorderStore.getState().reset();
  useRecorderStore.getState().setBusy(false);
});
describe("Recorder editing and recording", () => {
  it("records configuration without execution and rejects results for replaced/edited steps", () => {
    const store = useRecorderStore.getState();
    store.edit({ expected: "开始" });
    const before = useRecorderStore.getState().current;
    expect(store.save()).toBeUndefined();
    expect(useRecorderStore.getState().steps[0].result).toBeUndefined();
    expect(store.applyResult(before.id, before.version, success)).toBe(true);
    expect(useRecorderStore.getState().steps).toHaveLength(1);
    store.edit({ roi: [10, 20, 80, 40] });
    expect(store.applyResult(before.id, before.version, success)).toBe(false);
    expect(useRecorderStore.getState().current.result).toBeUndefined();
    const edited = useRecorderStore.getState().current;
    store.select();
    expect(store.applyResult(edited.id, edited.version, success)).toBe(false);
  });
  it("keeps independent selections and retains the session when closed", () => {
    const store = useRecorderStore.getState();
    store.edit({
      recognition: "TemplateMatch",
      templateImage: "template",
      templateRect: [1, 2, 3, 4],
      roi: [10, 20, 30, 40],
      target: [70, 80, 1, 1],
      targetMode: "fixed",
    });
    store.edit({ roi: [0, 0, 0, 0] });
    store.save();
    store.setOpen(true);
    store.setOpen(false);
    const state = useRecorderStore.getState();
    expect(state.current.config.templateRect).toEqual([1, 2, 3, 4]);
    expect(state.current.config.target).toEqual([70, 80, 1, 1]);
    expect(state.steps).toHaveLength(1);
  });
  it("execution feedback never adds a step", () => {
    const state = useRecorderStore.getState();
    state.applyResult(state.current.id, state.current.version, {
      ...success,
      action_success: true,
    });
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
    roi: [0, 0, 0, 0],
    expected: ["开始"],
    threshold: 0.3,
  });
  expect(result.nodes[1].data.recognition.param.template).toEqual([
    "recorder/session/button.png",
  ]);
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
