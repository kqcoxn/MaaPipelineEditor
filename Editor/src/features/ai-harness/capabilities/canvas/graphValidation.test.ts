import { describe, expect, it } from "vitest";
import { createPipelineNode } from "@/stores/flow";
import { validateCanvasGraph } from "./graphValidation";

describe("validateCanvasGraph", () => {
  it("校验不修改原始节点，并拒绝需要隐式修复的结构", () => {
    const node = createPipelineNode("1", { label: "开始" });
    node.data.recognition = { type: "" as never, param: {} };
    const before = structuredClone(node);

    const errors = validateCanvasGraph([node], []);

    expect(node).toEqual(before);
    expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("recognition")]));
  });
});
