import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NodeTypeEnum } from "./nodes/constants";
import { useFlowStore, type NodeType } from "../../stores/flow";
import * as nodeSnapSession from "../../core/nodeSnapSession";
import { useNodeSnap } from "./useNodeSnap";

function createNode(id: string, x: number, y: number): NodeType {
  return {
    id,
    type: NodeTypeEnum.Pipeline,
    data: { label: id },
    position: { x, y },
    measured: { width: 100, height: 60 },
  } as NodeType;
}

describe("useNodeSnap", () => {
  beforeEach(() => {
    const dragged = createNode("dragged", 0, 0);
    const candidate = createNode("candidate", 200, 0);
    const nodes = [dragged, candidate];
    useFlowStore.setState({
      nodes,
      nodeById: new Map(nodes.map((node) => [node.id, node])),
      viewport: { x: 0, y: 0, zoom: 1 },
      size: { width: 800, height: 600 },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reuses one index during pointer moves and applies the snap delta", () => {
    const updateNodes = vi.fn();
    const createSession = vi.spyOn(nodeSnapSession, "createNodeSnapSession");
    const { result } = renderHook(() =>
      useNodeSnap({ enabled: true, onlyInViewport: false, updateNodes }),
    );
    const dragged = useFlowStore.getState().nodes[0];
    const moved = { ...dragged, position: { x: 98, y: 0 } };

    act(() => result.current.start(dragged, [dragged]));
    const initialIndex = result.current;
    act(() => result.current.update(moved, [moved]));
    act(() => result.current.update(moved, [moved]));

    expect(result.current.start).toBe(initialIndex.start);
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(updateNodes).toHaveBeenLastCalledWith([
      {
        type: "position",
        id: "dragged",
        position: { x: 100, y: 0 },
        dragging: true,
      },
    ]);
    expect(result.current.guidelines).toEqual([
      { type: "vertical", position: 200 },
      { type: "horizontal", position: 0 },
    ]);

    act(() => result.current.stop(moved, [moved]));
    expect(result.current.guidelines).toEqual([]);
    act(() => result.current.start(dragged, [dragged]));
    expect(createSession).toHaveBeenCalledTimes(2);
  });

  it("moves every top-level selected node by the same delta", () => {
    const updateNodes = vi.fn();
    const peer = createNode("peer", 400, 100);
    const state = useFlowStore.getState();
    const nodes = [...state.nodes, peer];
    useFlowStore.setState({
      nodes,
      nodeById: new Map(nodes.map((node) => [node.id, node])),
    });
    const { result } = renderHook(() =>
      useNodeSnap({ enabled: true, onlyInViewport: false, updateNodes }),
    );
    const dragged = nodes[0];
    const moved = { ...dragged, position: { x: 98, y: 0 } };

    act(() => result.current.start(dragged, [dragged, peer]));
    act(() => result.current.update(moved, [moved, peer]));

    expect(updateNodes).toHaveBeenCalledWith([
      expect.objectContaining({ id: "dragged", position: { x: 100, y: 0 } }),
      expect.objectContaining({ id: "peer", position: { x: 402, y: 100 } }),
    ]);
  });

  it("rebuilds conservatively when the viewport snapshot changes", () => {
    const createSession = vi.spyOn(nodeSnapSession, "createNodeSnapSession");
    const { result } = renderHook(() =>
      useNodeSnap({
        enabled: true,
        onlyInViewport: true,
        updateNodes: vi.fn(),
      }),
    );
    const dragged = useFlowStore.getState().nodes[0];

    act(() => result.current.start(dragged, [dragged]));
    useFlowStore.setState({ viewport: { x: 20, y: 10, zoom: 1.5 } });
    act(() => result.current.update(dragged, [dragged]));

    expect(createSession).toHaveBeenCalledTimes(2);
  });
});
