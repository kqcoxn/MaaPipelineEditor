import { beforeEach, describe, expect, it } from "vitest";
import { NodeTypeEnum } from "@/components/flow/nodes";
import { createPipelineNode, useFlowStore } from "..";

describe("flow node id allocation", () => {
  beforeEach(() => {
    useFlowStore.getState().replace([], [], {
      isFitView: false,
      skipHistory: true,
    });
    useFlowStore.getState().resetNodeCounter();
    useFlowStore.getState().resetEdgeCounter();
  });

  it("shares one id sequence across node types", () => {
    const pipelineId = useFlowStore.getState().addNode({
      type: NodeTypeEnum.Pipeline,
    });
    const stickerId = useFlowStore.getState().addNode({
      type: NodeTypeEnum.Sticker,
    });

    expect(pipelineId).toBe("node_1");
    expect(stickerId).toBe("node_2");
  });

  it("uses the shared sequence when grouping selected nodes", () => {
    const first = createPipelineNode("legacy-first", {
      label: "First",
      position: { x: 0, y: 0 },
    });
    const second = createPipelineNode("legacy-second", {
      label: "Second",
      position: { x: 240, y: 0 },
    });
    useFlowStore.getState().replace([first, second], [], {
      isFitView: false,
      skipHistory: true,
    });
    useFlowStore.getState().updateSelection([first, second], []);

    useFlowStore.getState().groupSelectedNodes();

    const group = useFlowStore
      .getState()
      .nodes.find((node) => node.type === NodeTypeEnum.Group);
    expect(group?.id).toBe("node_1");
  });

  it("uses the shared edge sequence for automatic linking", () => {
    const sourceId = useFlowStore.getState().addNode({
      type: NodeTypeEnum.Pipeline,
    });
    const source = useFlowStore.getState().nodeById.get(sourceId)!;
    useFlowStore.getState().updateSelection([source], []);

    useFlowStore.getState().addNode({
      type: NodeTypeEnum.Pipeline,
      link: true,
    });

    expect(useFlowStore.getState().edges[0].id).toBe("edge_1");
  });
});
