import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPipelineNode } from "@/stores/flow/utils/nodeUtils";
import { applyNodeDataUpdates } from "@/stores/flow/utils/nodeDataUtils";
import { recordNodeEdit, recordGraphStructure } from "./graphEvents";
import { subscribeAchievementEvents } from "./bus";

let events: string[];
let dispose: () => void;
beforeEach(() => { events = []; dispose = subscribeAchievementEvents((event) => events.push(event.type)); });
afterEach(() => dispose());

describe("节点与结构行为口径", () => {
  it("无变化、必填字段及切换识别类型不会解锁可选字段成就", () => {
    const before = createPipelineNode("node");
    recordNodeEdit(before, before);
    expect(events).toEqual([]);
    const ocr = applyNodeDataUpdates(before, [{ type: "type", key: "recognition", value: "OCR" }]);
    recordNodeEdit(before, ocr);
    const expected = applyNodeDataUpdates(ocr, [{ type: "recognition", key: "expected", value: ["文字"] }]);
    recordNodeEdit(ocr, expected);
    expect(events).not.toContain("achievement:field_added");
  });

  it("空字符串与空列表不算填写，0 和 false 是有效字段值", () => {
    for (const value of ["", [], [""]]) {
      const before = createPipelineNode("node");
      recordNodeEdit(before, applyNodeDataUpdates(before, [{ type: "others", key: "timeout", value }]));
    }
    expect(events).not.toContain("achievement:field_added");
    for (const [key, value] of [["timeout", 0], ["enabled", false]] as const) {
      const before = createPipelineNode("node");
      recordNodeEdit(before, applyNodeDataUpdates(before, [{ type: "others", key, value }]));
    }
    expect(events.filter((event) => event === "achievement:field_added")).toHaveLength(2);
  });

  it("既有结构重新提交或仅移动节点不会授予结构成就", () => {
    const node = createPipelineNode("node");
    recordGraphStructure({ beforeNodes: [node], nodes: [{ ...node, position: { x: 100, y: 100 } }], beforeEdges: [], edges: [] });
    expect(events).toEqual([]);
  });
});
