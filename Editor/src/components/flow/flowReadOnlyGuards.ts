import type { EdgeChange, NodeChange } from "@xyflow/react";

export function allowedReadOnlyNodeChanges(changes: NodeChange[]): NodeChange[] {
  return changes.filter(
    (change) => change.type === "select" || change.type === "dimensions",
  );
}

export function allowedReadOnlyEdgeChanges(changes: EdgeChange[]): EdgeChange[] {
  return changes.filter((change) => change.type === "select");
}
