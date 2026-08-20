import { describe, expect, it } from "vitest";
import { createPipelineNode, type EdgeType, type NodeType } from "@/stores/flow";
import {
  CanvasCommandBus,
  type CanvasGraphState,
} from "../canvas/commandBus";
import {
  APPLY_SEMANTIC_LAYOUT_INTENT_TOOL_NAME,
  READ_SEMANTIC_LAYOUT_CONTEXT_TOOL_NAME,
  createSemanticLayoutToolHandlers,
} from "./tools";

describe("semantic layout Harness tools", () => {
  it("先读取确定性语义，再由本地布局算法原子提交位置", async () => {
    const start = createPipelineNode("start", {
      label: "开始",
      position: { x: 40, y: 60 },
    });
    const end = createPipelineNode("end", {
      label: "结束",
      position: { x: 40, y: 60 },
    });
    start.measured = end.measured = { width: 200, height: 100 };
    let graph: CanvasGraphState = {
      nodes: [start, end],
      edges: [
        {
          id: "next",
          source: "start",
          target: "end",
          sourceHandle: "next" as EdgeType["sourceHandle"],
          targetHandle: "target" as EdgeType["targetHandle"],
          label: 1,
          type: "marked",
        },
      ],
      selectedNodeIds: [],
      targetNodeId: null,
      fileName: "demo.json",
      prefix: "",
    };
    const bus = new CanvasCommandBus({
      read: () => graph,
      commit: (nodes: NodeType[], edges: EdgeType[]) => {
        graph = { ...graph, nodes, edges };
      },
    });
    const handlers = createSemanticLayoutToolHandlers(bus);
    const context = {
      runId: "run-layout",
      sessionId: "session-layout",
      fileName: "demo.json",
      expectedStateVersion: 1,
      signal: new AbortController().signal,
    };

    const semanticContext = await handlers[
      READ_SEMANTIC_LAYOUT_CONTEXT_TOOL_NAME
    ]({}, context);
    const applyResult = await handlers[
      APPLY_SEMANTIC_LAYOUT_INTENT_TOOL_NAME
    ](
      {
        expectedStateVersion: 1,
        direction: "RIGHT",
        lanes: [
          {
            id: "main",
            role: "primary",
            nodeIds: ["start", "end"],
          },
        ],
        relations: [],
      },
      context,
    );

    expect(semanticContext).toMatchObject({
      ok: true,
      stateVersion: 1,
      data: { layoutableNodeIds: ["start", "end"] },
    });
    expect(applyResult).toMatchObject({
      ok: true,
      stateVersion: 2,
      undoable: true,
      data: { appliedNodeCount: 2, laneCount: 1 },
    });
    expect(graph.nodes[1].position.x).toBeGreaterThan(graph.nodes[0].position.x);
  });
});
