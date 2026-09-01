import { NodeTypeEnum } from "../components/flow/nodes/constants";
import type { NodeType, PositionType } from "../stores/flow/types";
import { getNodeAbsolutePosition } from "../stores/flow/utils/coordinateUtils";
import {
  buildSnapAlignmentIndex,
  filterNodesInViewport,
  findSnapAlignmentWithIndex,
  type IndexedSnapResult,
  type SnapAlignmentIndex,
  type SnapNodeRect,
  type SnapViewportInfo,
} from "./snapUtils";

type NodeWithParent = NodeType & { parentId?: string };

export type NodeSnapSession = {
  index: SnapAlignmentIndex;
  excludedNodeIds: Set<string>;
  nodeById: ReadonlyMap<string, NodeType>;
};

type CreateNodeSnapSessionOptions = {
  nodes: NodeType[];
  nodeById: ReadonlyMap<string, NodeType>;
  draggedNodes: NodeType[];
  viewport?: SnapViewportInfo;
};

function collectExcludedNodeIds(
  nodes: NodeType[],
  draggedNodes: NodeType[],
): Set<string> {
  const excludedNodeIds = new Set(draggedNodes.map((node) => node.id));
  const childIdsByParentId = new Map<string, string[]>();

  for (const node of nodes) {
    const parentId = (node as NodeWithParent).parentId;
    if (!parentId) continue;
    const childIds = childIdsByParentId.get(parentId) ?? [];
    childIds.push(node.id);
    childIdsByParentId.set(parentId, childIds);
  }

  const pendingIds = [...excludedNodeIds];
  while (pendingIds.length > 0) {
    const parentId = pendingIds.pop()!;
    for (const childId of childIdsByParentId.get(parentId) ?? []) {
      if (excludedNodeIds.has(childId)) continue;
      excludedNodeIds.add(childId);
      pendingIds.push(childId);
    }
  }

  return excludedNodeIds;
}

function toAbsoluteSnapRect(
  node: NodeType,
  nodeById: ReadonlyMap<string, NodeType>,
): SnapNodeRect {
  return {
    id: node.id,
    position: getNodeAbsolutePosition(node, nodeById),
    measured: node.measured,
  };
}

export function createNodeSnapSession({
  nodes,
  nodeById,
  draggedNodes,
  viewport,
}: CreateNodeSnapSessionOptions): NodeSnapSession {
  const excludedNodeIds = collectExcludedNodeIds(nodes, draggedNodes);
  let candidates = nodes
    .filter(
      (node) =>
        node.type !== NodeTypeEnum.Group &&
        node.measured !== undefined &&
        !excludedNodeIds.has(node.id),
    )
    .map((node) => toAbsoluteSnapRect(node, nodeById));

  if (viewport) {
    candidates = filterNodesInViewport(candidates, viewport);
  }

  return {
    index: buildSnapAlignmentIndex(candidates),
    excludedNodeIds,
    nodeById,
  };
}

function getAbsoluteDraggedPosition(
  draggedNode: NodeType,
  draggedNodes: NodeType[],
  nodeById: ReadonlyMap<string, NodeType>,
): PositionType {
  const currentDraggedById = new Map(
    draggedNodes.map((node) => [node.id, node]),
  );
  const absolutePosition = { ...draggedNode.position };
  const visited = new Set<string>();
  let parentId = (draggedNode as NodeWithParent).parentId;

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = currentDraggedById.get(parentId) ?? nodeById.get(parentId);
    if (!parent) break;
    absolutePosition.x += parent.position.x;
    absolutePosition.y += parent.position.y;
    parentId = (parent as NodeWithParent).parentId;
  }

  return absolutePosition;
}

export function queryNodeSnapSession(
  session: NodeSnapSession,
  draggedNode: NodeType,
  draggedNodes: NodeType[],
  threshold = 5,
): IndexedSnapResult & { delta: PositionType } {
  const absolutePosition = getAbsoluteDraggedPosition(
    draggedNode,
    draggedNodes,
    session.nodeById,
  );
  const result = findSnapAlignmentWithIndex(
    {
      id: draggedNode.id,
      position: absolutePosition,
      measured: draggedNode.measured,
    },
    session.index,
    threshold,
  );

  return {
    ...result,
    delta: {
      x: result.position.x - absolutePosition.x,
      y: result.position.y - absolutePosition.y,
    },
  };
}
