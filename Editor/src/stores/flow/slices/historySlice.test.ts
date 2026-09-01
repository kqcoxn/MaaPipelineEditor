import type { NodeChange } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "@/components/flow/nodes";
import { useConfigStore } from "@/stores/app/configStore";
import { useOperationLogStore } from "@/stores/flow/operationLogStore";
import {
  createPipelineNode,
  useFlowStore,
  type EdgeType,
  type NodeType,
} from "..";

function createEdge(id: string, source: string, target: string): EdgeType {
  return {
    id,
    source,
    sourceHandle: SourceHandleTypeEnum.Next,
    target,
    targetHandle: TargetHandleTypeEnum.Target,
    label: 1,
    type: "marked",
  };
}

function initializeHistory(nodes: NodeType[], edges: EdgeType[] = []) {
  useFlowStore.getState().replace(nodes, edges, {
    isFitView: false,
    skipHistory: true,
  });
  const state = useFlowStore.getState();
  state.initHistory(state.nodes, state.edges);
}

function moveNode(id: string, x: number) {
  useFlowStore.getState().updateNodes([
    {
      type: "position",
      id,
      position: { x, y: x / 2 },
      dragging: false,
    } as NodeChange,
  ]);
  vi.runOnlyPendingTimers();
}

describe("flow patch history", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useConfigStore.getState().setConfig("historyLimit", 100);
    useOperationLogStore.getState().clearLogs();
    initializeHistory([]);
  });

  afterEach(() => {
    useFlowStore.getState().clearHistory();
    useConfigStore.getState().setConfig("historyLimit", 100);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("records a single-node move independently of total graph size", () => {
    const nodes = Array.from({ length: 300 }, (_, index) =>
      createPipelineNode(`node-${index}`, {
        position: { x: index * 10, y: index * 5 },
      }),
    );
    initializeHistory(nodes);

    moveNode("node-150", 9999);

    const entry = useFlowStore.getState().historyStack[1];
    expect(entry.kind).toBe("patch");
    if (entry.kind !== "patch") throw new Error("expected patch entry");
    expect(entry.patch.nodes).toHaveLength(1);
    expect(entry.patch.nodes[0].id).toBe("node-150");
    expect(entry.patch.edges).toHaveLength(0);
    expect("nodes" in entry).toBe(false);

    expect(useFlowStore.getState().undo()).toBe(true);
    expect(useFlowStore.getState().nodeById.get("node-150")?.position.x).toBe(
      1500,
    );
    expect(useFlowStore.getState().redo()).toBe(true);
    expect(useFlowStore.getState().nodeById.get("node-150")?.position.x).toBe(
      9999,
    );
  });

  it("protects edge history from later attribute mutation", () => {
    const source = createPipelineNode("source");
    const target = createPipelineNode("target");
    const edge = createEdge("edge", source.id, target.id);
    initializeHistory([source, target], [edge]);

    useFlowStore.getState().setEdgeData(edge.id, "anchor", true);
    vi.runOnlyPendingTimers();

    expect(edge.attributes).toBeUndefined();
    expect(useFlowStore.getState().edgeById.get(edge.id)?.attributes).toEqual({
      anchor: true,
    });
    expect(useFlowStore.getState().undo()).toBe(true);
    expect(
      useFlowStore.getState().edgeById.get(edge.id)?.attributes,
    ).toBeUndefined();
    expect(useFlowStore.getState().redo()).toBe(true);
    expect(useFlowStore.getState().edgeById.get(edge.id)?.attributes).toEqual({
      anchor: true,
    });
  });

  it("records import as one patch and restores both graph directions", () => {
    const beforeNode = createPipelineNode("before", { label: "Before" });
    const afterNode = createPipelineNode("after", { label: "After" });
    initializeHistory([beforeNode]);

    useFlowStore.getState().importHistory([afterNode], []);
    useFlowStore.getState().replace([afterNode], [], {
      isFitView: false,
      skipHistory: true,
    });

    expect(useFlowStore.getState().historyStack).toHaveLength(2);
    expect(useFlowStore.getState().undo()).toBe(true);
    expect(useFlowStore.getState().nodes.map((node) => node.id)).toEqual([
      "before",
    ]);
    expect(useFlowStore.getState().redo()).toBe(true);
    expect(useFlowStore.getState().nodes.map((node) => node.id)).toEqual([
      "after",
    ]);
  });

  it("trims on append and immediately when historyLimit decreases", () => {
    useConfigStore.getState().setConfig("historyLimit", 4);
    initializeHistory([createPipelineNode("node")]);

    for (let index = 1; index <= 5; index += 1) {
      moveNode("node", index * 10);
    }

    expect(useFlowStore.getState().historyStack).toHaveLength(4);
    expect(useFlowStore.getState().historyIndex).toBe(3);

    useConfigStore.getState().setConfig("historyLimit", 2);
    expect(useFlowStore.getState().historyStack).toHaveLength(2);
    expect(useFlowStore.getState().historyIndex).toBe(1);
    expect(useFlowStore.getState().undo()).toBe(true);
    expect(useFlowStore.getState().nodeById.get("node")?.position.x).toBe(40);
    expect(useFlowStore.getState().undo()).toBe(false);
  });

  it("drops the redo branch after a new edit", () => {
    initializeHistory([createPipelineNode("node")]);
    moveNode("node", 10);
    moveNode("node", 20);

    expect(useFlowStore.getState().undo()).toBe(true);
    moveNode("node", 30);

    expect(useFlowStore.getState().redo()).toBe(false);
    expect(useFlowStore.getState().historyStack).toHaveLength(3);
    expect(useFlowStore.getState().nodeById.get("node")?.position.x).toBe(30);
  });

  it("does not add history or logs for an equivalent update", () => {
    const node = createPipelineNode("node", { label: "Same" });
    initializeHistory([node]);

    useFlowStore.getState().setNodeData("node", "data", "label", "Same");
    vi.runOnlyPendingTimers();

    expect(useFlowStore.getState().historyStack).toHaveLength(1);
    expect(useOperationLogStore.getState().logs).toHaveLength(0);
  });
});
