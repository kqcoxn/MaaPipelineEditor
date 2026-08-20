import { describe, expect, it } from "vitest";
import { createPipelineNode, type EdgeType } from "@/stores/flow";
import { buildSemanticBlocks } from "./semanticBlocks";
import type { SemanticLayoutLane } from "./types";

function edge(id: string, source: string, target: string): EdgeType {
  return {
    id,
    source,
    target,
    sourceHandle: "next" as EdgeType["sourceHandle"],
    targetHandle: "target" as EdgeType["targetHandle"],
    label: 1,
    type: "marked",
  };
}

describe("buildSemanticBlocks", () => {
  it("在通用分叉边界切块并保留泳道角色", () => {
    const nodeIds = ["n1", "n2", "n3", "n4", "n5", "branch"];
    const nodes = nodeIds.map((id) =>
      createPipelineNode(id, { label: id, position: { x: 0, y: 0 } }),
    );
    const edges = [
      edge("e1", "n1", "n2"),
      edge("e2", "n2", "n3"),
      edge("e3", "n3", "n4"),
      edge("e4", "n3", "branch"),
      edge("e5", "n4", "n5"),
    ];
    const lanes: SemanticLayoutLane[] = [
      {
        id: "main",
        role: "primary",
        nodeIds: ["n1", "n2", "n3", "n4", "n5"],
      },
      { id: "branch", role: "branch", nodeIds: ["branch"] },
    ];
    const metrics = new Map(
      nodeIds.map((id) => [
        id,
        { inlineSize: 200, crossSize: 100 },
      ]),
    );

    const result = buildSemanticBlocks(
      nodes,
      edges,
      lanes,
      [],
      metrics,
      10,
    );

    expect(
      result.blocks
        .filter((block) => block.laneId === "main")
        .map((block) => block.nodeIds),
    ).toEqual([
      ["n1", "n2", "n3"],
      ["n4", "n5"],
    ]);
    expect(result.blocks.find((block) => block.laneId === "main")?.role).toBe(
      "primary",
    );
  });

  it("按上限拆分没有结构断点的超长连续段", () => {
    const nodeIds = Array.from({ length: 11 }, (_, index) => `n${index}`);
    const nodes = nodeIds.map((id) =>
      createPipelineNode(id, { label: id, position: { x: 0, y: 0 } }),
    );
    const edges = nodeIds
      .slice(1)
      .map((target, index) => edge(`e${index}`, nodeIds[index], target));
    const metrics = new Map(
      nodeIds.map((id) => [
        id,
        { inlineSize: 200, crossSize: 100 },
      ]),
    );

    const result = buildSemanticBlocks(
      nodes,
      edges,
      [{ id: "main", role: "primary", nodeIds }],
      [],
      metrics,
      5,
    );

    expect(result.blocks.map((block) => block.nodeIds.length)).toEqual([
      5, 5, 1,
    ]);
  });
});
