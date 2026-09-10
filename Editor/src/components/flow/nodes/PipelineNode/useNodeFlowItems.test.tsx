import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "../constants";
import {
  createPipelineNode,
  useFlowStore,
  type EdgeType,
} from "../../../../stores/flow";
import { useNodeFlowItems } from "./useNodeFlowItems";

function createEdge(id: string, target: string, label: number): EdgeType {
  return {
    id,
    source: "source",
    sourceHandle: SourceHandleTypeEnum.Next,
    target,
    targetHandle: TargetHandleTypeEnum.Target,
    label,
    type: "marked",
  };
}

describe("useNodeFlowItems", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const source = createPipelineNode("source", { label: "Source" });
    const first = createPipelineNode("first", { label: "First" });
    const second = createPipelineNode("second", { label: "Second" });
    useFlowStore.getState().replace(
      [source, first, second],
      [createEdge("to-second", "second", 2), createEdge("to-first", "first", 1)],
      { isFitView: false, skipHistory: true },
    );
    useFlowStore.getState().clearHistory();
  });

  afterEach(() => {
    useFlowStore.getState().clearHistory();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("ignores layout changes and reacts to semantic edge or node changes", () => {
    const { result } = renderHook(() => useNodeFlowItems("source"));
    expect(result.current.nextItems).toEqual([
      { label: "First", variant: "normal" },
      { label: "Second", variant: "normal" },
    ]);
    const initialResult = result.current;

    act(() => {
      useFlowStore.getState().updateNodes([
        {
          type: "position",
          id: "first",
          position: { x: 200, y: 300 },
          dragging: true,
        },
      ]);
    });
    expect(result.current).toBe(initialResult);

    act(() => {
      useFlowStore.getState().setNodeData("first", "data", "label", "Renamed");
    });
    expect(result.current.nextItems[0]).toEqual({
      label: "Renamed",
      variant: "normal",
    });

    act(() => {
      useFlowStore.getState().setEdgeData("to-first", "anchor", true);
    });
    expect(result.current.nextItems[0]).toEqual({
      label: "Renamed",
      variant: "anchor",
    });
  });

  it("pastes only internal edges and shows no empty next items after connecting", async () => {
    const state = useFlowStore.getState();
    // 选中节点时也可能选中了跨越复制范围的入边、出边。
    const copiedNodes = state.nodes.filter((node) => node.id !== "second");
    const copiedEdges = [
      ...state.edges,
      { ...createEdge("incoming", "source", 1), source: "second" },
    ];
    let pastedNodes: typeof copiedNodes = [];
    await act(async () => {
      pastedNodes = await state.paste(copiedNodes, copiedEdges);
    });
    const [source, first] = pastedNodes;
    const { result } = renderHook(() => useNodeFlowItems(source.id));
    act(() => {
      useFlowStore.getState().addEdge({
        source: source.id,
        sourceHandle: SourceHandleTypeEnum.Next,
        target: "second",
        targetHandle: TargetHandleTypeEnum.Target,
      });
    });
    expect(result.current.nextItems).toEqual([
      { label: first.data.label, variant: "normal" },
      { label: "Second", variant: "normal" },
    ]);
    expect(useFlowStore.getState().edges.every((edge) =>
      useFlowStore.getState().nodeById.has(edge.source) &&
      useFlowStore.getState().nodeById.has(edge.target),
    )).toBe(true);
    expect(copiedEdges.map((edge) => edge.target)).toEqual([
      "second", "first", "source",
    ]);
  });
});
