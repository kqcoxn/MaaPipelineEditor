import { afterEach, describe, expect, it } from "vitest";
import { createPipelineNode, useFlowStore } from "..";

describe("flow paste", () => {
  afterEach(() => {
    useFlowStore.setState({
      nodes: [],
      edges: [],
      selectedNodes: [],
      selectedEdges: [],
      pasteIdCounter: 1,
    });
  });

  it("returns the nodes created by the paste with their new ids", () => {
    const pastedNodes = useFlowStore
      .getState()
      .paste([createPipelineNode("source", { label: "Source" })], [], {
        x: 120,
        y: 80,
      });

    expect(pastedNodes).toHaveLength(1);
    expect(pastedNodes[0]).toMatchObject({
      id: "paste_1",
      position: { x: 120, y: 80 },
    });
    expect(useFlowStore.getState().nodes[0]).toBe(pastedNodes[0]);
  });
});
