import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "@/components/flow/nodes/constants";
import {
  createAnchorNode,
  createPipelineNode,
  useFlowStore,
  type EdgeType,
} from "..";
import { buildIncrementalSelectionChanges } from "../utils/selectionUtils";

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

describe("FlowStore incremental selection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useFlowStore.getState().clearSelection();
    const anchor = createAnchorNode("anchor", { label: "Shared" });
    const target = createPipelineNode("target", { label: "Target" });
    useFlowStore.getState().replace(
      [anchor, target],
      [createEdge("edge", anchor.id, target.id)],
      { isFitView: false, skipHistory: true },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("only emits changes for the previous and next selection", () => {
    useFlowStore.getState().selectNodeIds(["anchor"], { edgeIds: ["edge"] });
    expect(useFlowStore.getState().selectedAnchorName).toBe("Shared");

    const before = useFlowStore.getState();
    const changes = buildIncrementalSelectionChanges({
      selectedNodeIds: before.selectedNodeIds,
      selectedEdgeIds: before.selectedEdgeIds,
      targetNodeIds: new Set(["target"]),
      targetEdgeIds: new Set(),
    });
    expect(changes.nodeChanges).toEqual([
      { type: "select", id: "anchor", selected: false },
      { type: "select", id: "target", selected: true },
    ]);
    expect(changes.edgeChanges).toEqual([
      { type: "select", id: "edge", selected: false },
    ]);

    useFlowStore.getState().selectNodeIds(["target"]);

    const state = useFlowStore.getState();
    expect(state.selectedNodeIds).toEqual(new Set(["target"]));
    expect(state.selectedEdgeIds).toEqual(new Set());
    expect(state.selectedNodes.map((node) => node.id)).toEqual(["target"]);
    expect(state.targetNode?.id).toBe("target");
    expect(state.nodeById.get("anchor")?.selected).toBe(false);
    expect(state.nodeById.get("target")?.selected).toBe(true);
    expect(state.selectedAnchorName).toBeNull();
  });

  it("does not emit changes when the requested ID set is already selected", () => {
    useFlowStore.getState().selectNodeIds(["target"]);
    const before = useFlowStore.getState();

    useFlowStore.getState().selectNodeIds(["target", "missing"]);

    const after = useFlowStore.getState();
    expect(after.nodes).toBe(before.nodes);
    expect(after.edges).toBe(before.edges);
    expect(after.selectionRevision).toBe(before.selectionRevision);
  });
});
