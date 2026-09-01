import { beforeEach, describe, expect, it } from "vitest";
import type { EdgeChange } from "@xyflow/react";
import {
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "@/components/flow/nodes";
import { createPipelineNode, useFlowStore } from "..";

describe("flow edge id allocation", () => {
  beforeEach(() => {
    const nodes = [
      createPipelineNode("source", { label: "Source" }),
      createPipelineNode("first-target", { label: "First target" }),
      createPipelineNode("second-target", { label: "Second target" }),
    ];
    useFlowStore.getState().replace(nodes, [], {
      isFitView: false,
      skipHistory: true,
    });
    useFlowStore.getState().resetEdgeCounter();
  });

  it("allocates stable ids and rejects duplicate topology", () => {
    const connection = {
      source: "source",
      sourceHandle: SourceHandleTypeEnum.Next,
      target: "first-target",
      targetHandle: TargetHandleTypeEnum.Target,
    };

    useFlowStore.getState().addEdge(connection);
    useFlowStore.getState().addEdge(connection);

    expect(useFlowStore.getState().edges).toHaveLength(1);
    expect(useFlowStore.getState().edges[0].id).toBe("edge_1");
    expect(useFlowStore.getState().edgeIdCounter).toBe(2);

    const edge = useFlowStore.getState().edges[0];
    useFlowStore.getState().updateEdges([
      {
        type: "replace",
        id: edge.id,
        item: { ...edge, target: "second-target" },
      } as EdgeChange,
    ]);

    expect(useFlowStore.getState().edges[0]).toMatchObject({
      id: "edge_1",
      target: "second-target",
    });
  });
});
