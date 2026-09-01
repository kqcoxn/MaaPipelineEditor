import { beforeEach, describe, expect, it } from "vitest";
import {
  createPipelineNode,
  useFlowStore,
  type EdgeType,
} from "..";
import {
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "@/components/flow/nodes/constants";

describe("flow paste", () => {
  beforeEach(() => {
    useFlowStore.getState().replace([], [], {
      isFitView: false,
      skipHistory: true,
    });
    useFlowStore.getState().resetNodeCounter();
    useFlowStore.getState().resetEdgeCounter();
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
      id: "node_1",
      position: { x: 120, y: 80 },
      data: { label: "Source_副本1" },
    });
    expect(useFlowStore.getState().nodes[0]).toBe(pastedNodes[0]);

    const nextPastedNodes = useFlowStore
      .getState()
      .paste([createPipelineNode("source", { label: "Source" })], []);
    expect(nextPastedNodes[0]).toMatchObject({
      id: "node_2",
      data: { label: "Source_副本2" },
    });
  });

  it("keeps multi-paste node and edge selection representations consistent", () => {
    const first = createPipelineNode("first", { label: "First" });
    const second = createPipelineNode("second", { label: "Second" });
    const internalEdge: EdgeType = {
      id: "first-second",
      source: first.id,
      sourceHandle: SourceHandleTypeEnum.Next,
      target: second.id,
      targetHandle: TargetHandleTypeEnum.Target,
      label: 1,
      type: "marked",
      selected: false,
    };

    const pastedNodes = useFlowStore
      .getState()
      .paste([first, second], [internalEdge]);
    const state = useFlowStore.getState();
    const visuallySelectedNodeIds = state.nodes
      .filter((node) => node.selected)
      .map((node) => node.id);
    const visuallySelectedEdgeIds = state.edges
      .filter((edge) => edge.selected)
      .map((edge) => edge.id);

    expect(visuallySelectedEdgeIds).toEqual(["edge_1"]);

    expect(visuallySelectedNodeIds).toEqual(
      pastedNodes.map((node) => node.id),
    );
    expect(visuallySelectedNodeIds).toEqual(
      state.selectedNodes.map((node) => node.id),
    );
    expect(visuallySelectedNodeIds).toEqual([...state.selectedNodeIds]);
    expect(visuallySelectedEdgeIds).toEqual(
      state.selectedEdges.map((edge) => edge.id),
    );
    expect(visuallySelectedEdgeIds).toEqual([...state.selectedEdgeIds]);
  });

  it("restores the edge id counter when replacing the graph", () => {
    const source = createPipelineNode("source", { label: "Source" });
    const firstTarget = createPipelineNode("first-target", {
      label: "First target",
    });
    const secondTarget = createPipelineNode("second-target", {
      label: "Second target",
    });
    const existingEdge: EdgeType = {
      id: "edge_7",
      source: source.id,
      sourceHandle: SourceHandleTypeEnum.Next,
      target: firstTarget.id,
      targetHandle: TargetHandleTypeEnum.Target,
      label: 1,
      type: "marked",
    };

    useFlowStore
      .getState()
      .replace([source, firstTarget, secondTarget], [existingEdge], {
        isFitView: false,
        skipHistory: true,
      });
    useFlowStore.getState().addEdge({
      source: source.id,
      sourceHandle: SourceHandleTypeEnum.Next,
      target: secondTarget.id,
      targetHandle: TargetHandleTypeEnum.Target,
    });

    expect(useFlowStore.getState().edges.map((edge) => edge.id)).toEqual([
      "edge_7",
      "edge_8",
    ]);
    expect(useFlowStore.getState().edgeIdCounter).toBe(9);
  });
});
