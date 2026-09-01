import type { EdgeChange, NodeChange } from "@xyflow/react";

interface IncrementalSelectionChangesOptions {
  selectedNodeIds: ReadonlySet<string>;
  selectedEdgeIds: ReadonlySet<string>;
  targetNodeIds: ReadonlySet<string>;
  targetEdgeIds: ReadonlySet<string>;
}

export interface IncrementalSelectionChanges {
  nodeChanges: NodeChange[];
  edgeChanges: EdgeChange[];
}

function buildSelectChanges(
  selectedIds: ReadonlySet<string>,
  targetIds: ReadonlySet<string>,
): Array<{ type: "select"; id: string; selected: boolean }> {
  const changes: Array<{ type: "select"; id: string; selected: boolean }> = [];

  for (const id of selectedIds) {
    if (!targetIds.has(id)) {
      changes.push({ type: "select", id, selected: false });
    }
  }
  for (const id of targetIds) {
    if (!selectedIds.has(id)) {
      changes.push({ type: "select", id, selected: true });
    }
  }

  return changes;
}

export function buildIncrementalSelectionChanges({
  selectedNodeIds,
  selectedEdgeIds,
  targetNodeIds,
  targetEdgeIds,
}: IncrementalSelectionChangesOptions): IncrementalSelectionChanges {
  return {
    nodeChanges: buildSelectChanges(selectedNodeIds, targetNodeIds),
    edgeChanges: buildSelectChanges(selectedEdgeIds, targetEdgeIds),
  };
}
