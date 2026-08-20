import { describe, expect, it } from "vitest";
import { createPipelineNode, type EdgeType } from "@/stores/flow";
import type { CanvasGraphState } from "../canvas/commandBus";
import { buildSemanticLayoutContext } from "./semanticGraph";

function edge(
  id: string,
  source: string,
  target: string,
  label: number,
  options: Partial<EdgeType> = {},
): EdgeType {
  return {
    id,
    source,
    target,
    sourceHandle: "next" as EdgeType["sourceHandle"],
    targetHandle: "target" as EdgeType["targetHandle"],
    label,
    type: "marked",
    ...options,
  };
}

describe("buildSemanticLayoutContext", () => {
  it("提取有序候选、JumpBack、错误域、真实循环和节点引用", () => {
    const start = createPipelineNode("start", { label: "开始" });
    const normal = createPipelineNode("normal", { label: "普通流程" });
    const popup = createPipelineNode("popup", { label: "弹窗处理" });
    const recovery = createPipelineNode("recovery", { label: "错误恢复" });
    start.data.recognition.param.roi = "普通流程";
    normal.data.action.param.target = "[Anchor]最近目标";
    const graph: CanvasGraphState = {
      nodes: [start, normal, popup, recovery],
      edges: [
        edge("next-normal", "start", "normal", 2),
        edge("next-popup", "start", "popup", 1, {
          targetHandle: "jump_back" as EdgeType["targetHandle"],
          attributes: { jump_back: true },
        }),
        edge("loop", "normal", "start", 1),
        edge("error", "start", "recovery", 1, {
          sourceHandle: "on_error" as EdgeType["sourceHandle"],
        }),
      ],
      selectedNodeIds: [],
      targetNodeId: null,
      fileName: "demo.json",
      prefix: "",
    };

    const context = buildSemanticLayoutContext(graph, 7);

    expect(context.candidateSets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "start",
          kind: "next",
          candidates: [
            { nodeId: "popup", order: 1, jumpBack: true },
            { nodeId: "normal", order: 2, jumpBack: false },
          ],
        }),
      ]),
    );
    expect(context.controlEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "next-popup",
          kind: "jump_back",
          returnsToSource: true,
        }),
        expect.objectContaining({ id: "error", kind: "on_error" }),
      ]),
    );
    expect(context.stronglyConnectedComponents[0]).toEqual(
      expect.arrayContaining(["start", "normal"]),
    );
    expect(context.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: "start",
          field: "roi",
          targetNodeIds: ["normal"],
        }),
        expect.objectContaining({
          sourceId: "normal",
          field: "target",
          dynamicAnchor: true,
        }),
      ]),
    );
  });
});
