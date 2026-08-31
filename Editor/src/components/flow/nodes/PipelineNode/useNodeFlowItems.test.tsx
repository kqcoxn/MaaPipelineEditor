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
});
