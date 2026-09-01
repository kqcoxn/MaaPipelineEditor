import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGroupNode,
  createPipelineNode,
  useFlowStore,
  type EdgeType,
} from "..";
import {
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "@/components/flow/nodes/constants";
import { useProcessStore } from "@/stores/ui/processStore";
import { useFileStore } from "@/stores/project/fileStore";

describe("flow paste", () => {
  beforeEach(() => {
    useFlowStore.getState().replace([], [], {
      isFitView: false,
      skipHistory: true,
    });
    useFlowStore.getState().resetNodeCounter();
    useFlowStore.getState().resetEdgeCounter();
    useProcessStore.setState({ entries: [] });
  });

  it("returns the nodes created by the paste with their new ids", async () => {
    const pastedNodes = await useFlowStore
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

    const nextPastedNodes = await useFlowStore
      .getState()
      .paste([createPipelineNode("source", { label: "Source" })], []);
    expect(nextPastedNodes[0]).toMatchObject({
      id: "node_2",
      data: { label: "Source_副本2" },
    });
  });

  it("keeps multi-paste node and edge selection representations consistent", async () => {
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

    const pastedNodes = await useFlowStore
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

  it("only shows process feedback above 100 pasted nodes", async () => {
    const createNodes = (count: number) =>
      Array.from({ length: count }, (_, index) =>
        createPipelineNode(`source-${index}`, { label: `Source ${index}` }),
      );

    const hundredNodePaste = useFlowStore.getState().paste(createNodes(100), []);
    expect(useProcessStore.getState().entries).toEqual([]);
    await expect(hundredNodePaste).resolves.toHaveLength(100);

    const largePaste = useFlowStore.getState().paste(createNodes(101), []);
    expect(useProcessStore.getState().entries).toEqual([
      expect.objectContaining({
        label: "正在粘贴节点",
        detail: "正在复制 101 个节点",
      }),
    ]);
    await expect(largePaste).resolves.toHaveLength(101);
    expect(useProcessStore.getState().entries).toEqual([]);
  });

  it("commits node order configuration once for a large paste", async () => {
    const nodes = Array.from({ length: 101 }, (_, index) =>
      createPipelineNode(`source-${index}`, { label: `Source ${index}` }),
    );
    const setFileConfigs = vi.spyOn(
      useFileStore.getState(),
      "setFileConfigs",
    );

    await useFlowStore.getState().paste(nodes, []);

    expect(setFileConfigs).toHaveBeenCalledTimes(1);
    setFileConfigs.mockRestore();
  });

  it("reports fixed stages while preparing a large paste", async () => {
    const nodes = Array.from({ length: 101 }, (_, index) =>
      createPipelineNode(`source-${index}`, { label: `Source ${index}` }),
    );
    const details: string[] = [];
    const unsubscribe = useProcessStore.subscribe((state) => {
      const detail = state.entries[state.entries.length - 1]?.detail;
      if (detail) details.push(detail);
    });

    await useFlowStore.getState().paste(nodes, []);
    unsubscribe();

    expect(details).toEqual([
      "正在复制 101 个节点",
      "正在刷新画布",
    ]);
  });

  it("preserves copied group relationships and relative positions", async () => {
    const group = createGroupNode("group", {
      label: "Group",
      position: { x: 100, y: 100 },
    });
    const child = createPipelineNode("child", {
      label: "Child",
      position: { x: 10, y: 20 },
    });
    child.parentId = group.id;

    const pastedNodes = await useFlowStore
      .getState()
      .paste([child, group], []);
    const pastedGroup = pastedNodes.find((node) => node.type === "group");
    const pastedChild = pastedNodes.find((node) => node.type !== "group");

    expect(pastedGroup).toBeDefined();
    expect(pastedChild).toMatchObject({
      parentId: pastedGroup?.id,
      position: { x: 10, y: 20 },
    });
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
