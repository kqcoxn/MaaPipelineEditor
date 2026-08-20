import { describe, expect, it } from "vitest";
import { buildBusinessArchitectureGraph } from "./architectureGraph";
import type { BusinessArchitectureDocument } from "./types";

describe("buildBusinessArchitectureGraph", () => {
  it("循环关系不会把阶段布局成无限层级", () => {
    const document: BusinessArchitectureDocument = {
      title: "循环作业",
      summary: "重复执行并在异常时恢复。",
      fileName: "loop.json",
      sourceRunId: "run-loop",
      sourceStateVersion: 1,
      sourceSignature: "signature",
      generatedAt: 1,
      coverage: {
        includedNodeCount: 3,
        totalNodeCount: 3,
        autoAssignedNodeIds: [],
      },
      stages: [
        { id: "a", title: "开始", description: "开始。", kind: "main", nodeIds: ["1"] },
        { id: "b", title: "执行", description: "执行。", kind: "loop", nodeIds: ["2"] },
        { id: "c", title: "恢复", description: "恢复。", kind: "error", nodeIds: ["3"] },
      ],
      transitions: [
        { id: "ab", sourceStageId: "a", targetStageId: "b", kind: "next", order: 1, edgeCount: 1 },
        { id: "ba", sourceStageId: "b", targetStageId: "a", kind: "jump_back", order: 1, edgeCount: 1 },
        { id: "bc", sourceStageId: "b", targetStageId: "c", kind: "on_error", order: 1, edgeCount: 1 },
      ],
    };

    const graph = buildBusinessArchitectureGraph(document);
    const maxX = Math.max(...graph.nodes.map((node) => node.position.x));

    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(3);
    expect(maxX).toBeLessThan(1000);
  });
});
