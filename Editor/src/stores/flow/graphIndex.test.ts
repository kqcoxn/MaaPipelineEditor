import type { EdgeChange, NodeChange } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NodeTypeEnum,
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "@/components/flow/nodes";
import {
  createAnchorNode,
  createExternalNode,
  createPipelineNode,
  getNodeTypeLabelKey,
  useFlowStore,
  type EdgeType,
  type NodeType,
  type PipelineNodeType,
} from ".";

function createEdge(
  id: string,
  source: string,
  target: string,
  label: number = 1,
): EdgeType {
  return {
    id,
    source,
    sourceHandle: SourceHandleTypeEnum.Next,
    target,
    targetHandle: TargetHandleTypeEnum.Target,
    label,
    type: "marked",
  };
}

function normalizeSetMap(map: Map<string, Set<string>>) {
  return [...map.entries()]
    .map(([key, values]) => [key, [...values].sort()] as const)
    .sort(([left], [right]) => left.localeCompare(right));
}

function extractAnchorNames(node: NodeType): string[] {
  if (node.type !== NodeTypeEnum.Pipeline) return [];
  const value = (node as PipelineNodeType).data.others.anchor;
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (value && typeof value === "object") return Object.keys(value);
  return [];
}

function expectIndexesToMatchGraph() {
  const state = useFlowStore.getState();
  expect([...state.nodeById.keys()].sort()).toEqual(
    state.nodes.map((node) => node.id).sort(),
  );
  expect([...state.edgeById.keys()].sort()).toEqual(
    state.edges.map((edge) => edge.id).sort(),
  );

  const expectedTypeLabels = new Map<string, Set<string>>();
  const expectedAnchors = new Map<string, Set<string>>();
  for (const node of state.nodes) {
    expect(state.nodeById.get(node.id)).toBe(node);
    expect(state.nodeSemanticById.get(node.id)).toEqual({
      id: node.id,
      type: node.type,
      label: node.data.label,
    });

    const key = getNodeTypeLabelKey(node.type, node.data.label);
    const ids = expectedTypeLabels.get(key) ?? new Set();
    ids.add(node.id);
    expectedTypeLabels.set(key, ids);

    for (const anchorName of extractAnchorNames(node)) {
      const referenceIds = expectedAnchors.get(anchorName) ?? new Set();
      referenceIds.add(node.id);
      expectedAnchors.set(anchorName, referenceIds);
    }

    expect(
      [...(state.outgoingEdgeIdsByNodeId.get(node.id) ?? [])].sort(),
    ).toEqual(
      state.edges
        .filter((edge) => edge.source === node.id)
        .map((edge) => edge.id)
        .sort(),
    );
    expect(
      [...(state.incomingEdgeIdsByNodeId.get(node.id) ?? [])].sort(),
    ).toEqual(
      state.edges
        .filter((edge) => edge.target === node.id)
        .map((edge) => edge.id)
        .sort(),
    );
  }

  for (const edge of state.edges) {
    expect(state.edgeById.get(edge.id)).toBe(edge);
  }
  expect(normalizeSetMap(state.nodeIdsByTypeAndLabel)).toEqual(
    normalizeSetMap(expectedTypeLabels),
  );
  expect(normalizeSetMap(state.anchorReferenceIndex)).toEqual(
    normalizeSetMap(expectedAnchors),
  );
  expect([...state.selectedNodeIds].sort()).toEqual(
    state.selectedNodes.map((node) => node.id).sort(),
  );
  expect([...state.selectedEdgeIds].sort()).toEqual(
    state.selectedEdges.map((edge) => edge.id).sort(),
  );
}

function createDeterministicGraph(): { nodes: NodeType[]; edges: EdgeType[] } {
  let seed = 0x5f3759df;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const nodes = Array.from({ length: 40 }, (_, index) => {
    const id = `node-${index}`;
    const position = {
      x: Math.round(random() * 3000),
      y: Math.round(random() * 2000),
    };
    if (index % 13 === 0) {
      return createAnchorNode(id, { label: `Anchor-${index % 2}`, position });
    }
    if (index % 11 === 0) {
      return createExternalNode(id, {
        label: `External-${index % 3}`,
        position,
      });
    }
    return createPipelineNode(id, {
      label: `Pipeline-${index}`,
      position,
      datas:
        index % 7 === 0
          ? { others: { anchor: [`A-${index % 3}`, "Shared"] } }
          : undefined,
    });
  });
  const edges = Array.from({ length: 100 }, (_, index) => {
    const sourceIndex = Math.floor(random() * nodes.length);
    let targetIndex = Math.floor(random() * nodes.length);
    if (targetIndex === sourceIndex) targetIndex = (targetIndex + 1) % nodes.length;
    return createEdge(
      `edge-${index}`,
      nodes[sourceIndex].id,
      nodes[targetIndex].id,
      index + 1,
    );
  });
  return { nodes, edges };
}

describe("FlowStore graph indexes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useFlowStore.getState().replace([], [], {
      isFitView: false,
      skipHistory: true,
    });
    useFlowStore.getState().clearHistory();
  });

  afterEach(() => {
    useFlowStore.getState().clearHistory();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("keeps indexes consistent through graph editing actions", () => {
    const graph = createDeterministicGraph();
    useFlowStore.getState().replace(graph.nodes, graph.edges, {
      isFitView: false,
      skipHistory: true,
    });
    expectIndexesToMatchGraph();

    for (let index = 0; index < 20; index += 1) {
      const node = useFlowStore.getState().nodeById.get(`node-${index}`)!;
      useFlowStore.getState().updateNodes([
        {
          type: "position",
          id: node.id,
          position: { x: node.position.x + index + 1, y: node.position.y - index },
          dragging: false,
        },
      ]);
      expectIndexesToMatchGraph();
    }

    useFlowStore.getState().setNodeData("node-1", "data", "label", "Renamed");
    useFlowStore
      .getState()
      .batchSetNodeData("node-7", [
        { type: "others", key: "anchor", value: ["Shared", "Added"] },
        { type: "others", key: "enabled", value: false },
      ]);
    useFlowStore.getState().setEdgeData("edge-0", "anchor", true);
    useFlowStore.getState().setEdgeLabel("edge-1", 1);
    expectIndexesToMatchGraph();

    const reconnect = useFlowStore.getState().edgeById.get("edge-2")!;
    useFlowStore.getState().updateEdges([
      {
        type: "replace",
        id: reconnect.id,
        item: { ...reconnect, target: "node-3" },
      } as EdgeChange,
    ]);
    useFlowStore.getState().updateEdges([
      { type: "remove", id: "edge-3" } as EdgeChange,
    ]);
    const addedNodeId = useFlowStore.getState().addNode({
      type: NodeTypeEnum.Pipeline,
      position: { x: 500, y: 600 },
    });
    useFlowStore.getState().addEdge({
      source: "node-1",
      sourceHandle: SourceHandleTypeEnum.Next,
      target: addedNodeId,
      targetHandle: TargetHandleTypeEnum.Target,
    });
    useFlowStore.getState().updateSelection(
      [useFlowStore.getState().nodeById.get("node-2")!],
      [],
    );
    const linkedNodeId = useFlowStore.getState().addNode({
      type: NodeTypeEnum.Pipeline,
      position: { x: 700, y: 800 },
      link: true,
    });
    expect(
      (useFlowStore.getState().outgoingEdgeIdsByNodeId.get("node-2") ?? [])
        .map((edgeId) => useFlowStore.getState().edgeById.get(edgeId))
        .some((edge) => edge?.target === linkedNodeId),
    ).toBe(true);
    useFlowStore.getState().updateNodes([
      { type: "remove", id: "node-39" } as NodeChange,
    ]);
    expectIndexesToMatchGraph();

    const selectedNodes = [
      useFlowStore.getState().nodeById.get("node-4")!,
      useFlowStore.getState().nodeById.get("node-5")!,
    ];
    useFlowStore.getState().updateSelection(selectedNodes, []);
    useFlowStore.getState().groupSelectedNodes();
    expectIndexesToMatchGraph();
    const group = useFlowStore
      .getState()
      .nodes.find((node) => node.type === NodeTypeEnum.Group)!;
    useFlowStore.getState().ungroupNodes(group.id);
    expectIndexesToMatchGraph();
  });

  it("keeps topology and semantic selectors stable during position updates", () => {
    const graph = createDeterministicGraph();
    useFlowStore.getState().replace(graph.nodes, graph.edges, {
      isFitView: false,
      skipHistory: true,
    });
    const initial = useFlowStore.getState();
    const semanticMap = initial.nodeSemanticById;
    const outgoingIds = initial.outgoingEdgeIdsByNodeId;
    const topologyRevision = initial.topologyRevision;
    const semanticRevision = initial.semanticRevision;
    let semanticNotifications = 0;
    let topologyNotifications = 0;
    const unsubscribeSemantic = useFlowStore.subscribe(
      (state) => state.nodeSemanticById.get("node-1"),
      () => {
        semanticNotifications += 1;
      },
    );
    const unsubscribeTopology = useFlowStore.subscribe(
      (state) => state.topologyRevision,
      () => {
        topologyNotifications += 1;
      },
    );

    for (let index = 0; index < 100; index += 1) {
      useFlowStore.getState().updateNodes([
        {
          type: "position",
          id: "node-1",
          position: { x: index * 3, y: index * 2 },
          dragging: true,
        },
      ]);
    }

    const current = useFlowStore.getState();
    expect(current.layoutRevision).toBe(initial.layoutRevision + 100);
    expect(current.topologyRevision).toBe(topologyRevision);
    expect(current.semanticRevision).toBe(semanticRevision);
    expect(current.nodeSemanticById).toBe(semanticMap);
    expect(current.outgoingEdgeIdsByNodeId).toBe(outgoingIds);
    expect(semanticNotifications).toBe(0);
    expect(topologyNotifications).toBe(0);

    useFlowStore.getState().updateNodes([
      {
        type: "position",
        id: "node-1",
        position: { x: 297, y: 198 },
        dragging: false,
      },
    ]);
    expectIndexesToMatchGraph();

    unsubscribeSemantic();
    unsubscribeTopology();
  });

  it("defers full node index replacement during an active drag", () => {
    const graph = createDeterministicGraph();
    useFlowStore.getState().replace(graph.nodes, graph.edges, {
      isFitView: false,
      skipHistory: true,
    });
    const initial = useFlowStore.getState();
    const initialNode = initial.nodeById.get("node-1")!;
    const nextPosition = {
      x: initialNode.position.x + 120,
      y: initialNode.position.y + 80,
    };

    useFlowStore.getState().updateNodes([
      {
        type: "position",
        id: initialNode.id,
        position: nextPosition,
        dragging: true,
      },
    ]);

    const dragging = useFlowStore.getState();
    expect(dragging.nodeById).toBe(initial.nodeById);
    expect(dragging.nodeById.get(initialNode.id)).toBe(initialNode);
    expect(dragging.nodes.find((node) => node.id === initialNode.id)).not.toBe(
      initialNode,
    );

    useFlowStore.getState().updateNodes([
      {
        type: "position",
        id: initialNode.id,
        position: nextPosition,
        dragging: false,
      },
    ]);

    const released = useFlowStore.getState();
    const releasedNode = released.nodes.find(
      (node) => node.id === initialNode.id,
    )!;
    expect(released.nodeById).not.toBe(initial.nodeById);
    expect(released.nodeById.get(initialNode.id)).toBe(releasedNode);
  });

  it("increments only the revision owned by each change category", () => {
    const nodes = [
      createPipelineNode("source", { label: "Source" }),
      createPipelineNode("target", { label: "Target" }),
    ];
    const edge = createEdge("source-target", "source", "target");
    useFlowStore.getState().replace(nodes, [edge], {
      isFitView: false,
      skipHistory: true,
    });
    const initial = useFlowStore.getState();

    useFlowStore.getState().updateNodes([
      {
        type: "position",
        id: "source",
        position: { x: 20, y: 30 },
        dragging: true,
      },
    ]);
    let current = useFlowStore.getState();
    expect(current.layoutRevision).toBe(initial.layoutRevision + 1);
    expect(current.topologyRevision).toBe(initial.topologyRevision);
    expect(current.semanticRevision).toBe(initial.semanticRevision);
    expect(current.selectionRevision).toBe(initial.selectionRevision);

    useFlowStore.getState().updateSelection([current.nodeById.get("source")!], []);
    current = useFlowStore.getState();
    expect(current.selectionRevision).toBe(initial.selectionRevision + 1);
    expect(current.topologyRevision).toBe(initial.topologyRevision);
    expect(current.semanticRevision).toBe(initial.semanticRevision);

    useFlowStore.getState().setNodeData("source", "data", "label", "Renamed");
    current = useFlowStore.getState();
    expect(current.semanticRevision).toBe(initial.semanticRevision + 1);
    expect(current.topologyRevision).toBe(initial.topologyRevision);

    const currentEdge = current.edgeById.get(edge.id)!;
    useFlowStore.getState().updateEdges([
      {
        type: "replace",
        id: currentEdge.id,
        item: { ...currentEdge, target: "source" },
      } as EdgeChange,
    ]);
    current = useFlowStore.getState();
    expect(current.topologyRevision).toBe(initial.topologyRevision + 1);
    expect(current.semanticRevision).toBe(initial.semanticRevision + 1);

    useFlowStore.getState().setEdgeData(edge.id, "anchor", true);
    current = useFlowStore.getState();
    expect(current.topologyRevision).toBe(initial.topologyRevision + 1);
    expect(current.semanticRevision).toBe(initial.semanticRevision + 2);
  });

  it("refreshes selected edge endpoints when a selected edge reconnects", () => {
    const nodes = [
      createPipelineNode("source", { label: "Source" }),
      createPipelineNode("first-target", { label: "First target" }),
      createPipelineNode("second-target", { label: "Second target" }),
    ];
    const edge = {
      ...createEdge("selected-edge", "source", "first-target"),
      selected: true,
    };
    useFlowStore.getState().replace(nodes, [edge], {
      isFitView: false,
      skipHistory: true,
    });
    useFlowStore.getState().updateSelection([], [edge]);

    useFlowStore.getState().updateEdges([
      {
        type: "replace",
        id: edge.id,
        item: { ...edge, target: "second-target" },
      } as EdgeChange,
    ]);

    expect(useFlowStore.getState().selectedEdgeEndpointNodeIds).toEqual(
      new Set(["source", "second-target"]),
    );
  });

  it("rebuilds complete indexes after undo and redo", () => {
    const original = createPipelineNode("entry", { label: "Original" });
    useFlowStore.getState().replace([original], [], {
      isFitView: false,
      skipHistory: true,
    });
    useFlowStore.getState().initHistory([original], []);

    useFlowStore.getState().setNodeData("entry", "data", "label", "Changed");
    vi.advanceTimersByTime(1000);
    expect(useFlowStore.getState().historyStack).toHaveLength(2);
    expect(useFlowStore.getState().undo()).toBe(true);
    expect(useFlowStore.getState().nodeSemanticById.get("entry")?.label).toBe(
      "Original",
    );
    expectIndexesToMatchGraph();

    expect(useFlowStore.getState().redo()).toBe(true);
    expect(useFlowStore.getState().nodeSemanticById.get("entry")?.label).toBe(
      "Changed",
    );
    expectIndexesToMatchGraph();
  });
});
