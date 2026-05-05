import type { ReactFlowInstance } from "@xyflow/react";
import type { NodeType, PositionType } from "../types";

export type CoordinateMode = "relative-legacy" | "absolute-v1";

export interface RectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}
const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 100;

type NodeWithParent = NodeType & { parentId?: string };
type NodeWithLayout = {
  measured?: {
    width?: number;
    height?: number;
  };
  width?: number;
  height?: number;
  style?: {
    width?: number;
    height?: number;
  };
};

function getParentId(node: NodeType): string | undefined {
  return (node as NodeWithParent).parentId;
}

function findNodeById(nodes: NodeType[], id: string): NodeType | undefined {
  return nodes.find((node) => node.id === id);
}

function resolveRectDimensions(
  ...sources: Array<NodeWithLayout | undefined>
): { width: number; height: number } {
  const width =
    sources.find((source) => source?.measured?.width != null)?.measured?.width ??
    sources.find((source) => source?.width != null)?.width ??
    sources.find((source) => source?.style?.width != null)?.style?.width ??
    DEFAULT_NODE_WIDTH;
  const height =
    sources.find((source) => source?.measured?.height != null)?.measured?.height ??
    sources.find((source) => source?.height != null)?.height ??
    sources.find((source) => source?.style?.height != null)?.style?.height ??
    DEFAULT_NODE_HEIGHT;

  return { width, height };
}

export function toRelativePositionFromParentAbsolute(
  absolutePosition: PositionType,
  parentAbsolutePosition: PositionType,
): PositionType {
  return {
    x: absolutePosition.x - parentAbsolutePosition.x,
    y: absolutePosition.y - parentAbsolutePosition.y,
  };
}

export function resolveParentChain(
  node: NodeType,
  allNodes: NodeType[],
): NodeType[] {
  const chain: NodeType[] = [];
  const visited = new Set<string>();
  let currentParentId = getParentId(node);

  while (currentParentId && !visited.has(currentParentId)) {
    visited.add(currentParentId);
    const parentNode = findNodeById(allNodes, currentParentId);
    if (!parentNode) {
      break;
    }
    chain.unshift(parentNode);
    currentParentId = getParentId(parentNode);
  }

  return chain;
}

export function getNodeAbsolutePosition(
  node: NodeType,
  allNodes: NodeType[],
): PositionType {
  const absolutePosition = { ...node.position };
  const parentChain = resolveParentChain(node, allNodes);

  parentChain.forEach((parentNode) => {
    absolutePosition.x += parentNode.position.x;
    absolutePosition.y += parentNode.position.y;
  });

  return absolutePosition;
}

export function getNodeAbsoluteRect(
  node: NodeType,
  allNodes: NodeType[],
): RectLike {
  const absolutePosition = getNodeAbsolutePosition(node, allNodes);
  const { width, height } = resolveRectDimensions(node as NodeWithLayout);

  return {
    x: absolutePosition.x,
    y: absolutePosition.y,
    width,
    height,
  };
}

export function getRuntimeNodeAbsoluteRect(
  instance: ReactFlowInstance | null,
  nodeId: string,
  fallbackNode?: NodeType,
  allNodes?: NodeType[],
): RectLike | undefined {
  const runtimeNode = instance?.getInternalNode(nodeId);
  const runtimePosition = runtimeNode?.internals?.positionAbsolute;

  if (runtimePosition) {
    const { width, height } = resolveRectDimensions(
      runtimeNode as NodeWithLayout,
      runtimeNode?.internals?.userNode as NodeWithLayout | undefined,
      fallbackNode as NodeWithLayout | undefined,
    );

    return {
      x: runtimePosition.x,
      y: runtimePosition.y,
      width,
      height,
    };
  }

  if (!fallbackNode || !allNodes) {
    return undefined;
  }

  return getNodeAbsoluteRect(fallbackNode, allNodes);
}

export function toRelativePosition(
  absolutePosition: PositionType,
  parentNode: NodeType,
  allNodes?: NodeType[],
): PositionType {
  const parentAbsolute = allNodes
    ? getNodeAbsolutePosition(parentNode, allNodes)
    : parentNode.position;

  return toRelativePositionFromParentAbsolute(
    absolutePosition,
    parentAbsolute,
  );
}

export function normalizeImportedNodePosition(
  node: NodeType,
  allNodes: NodeType[],
  coordinateMode: CoordinateMode,
): NodeType {
  const parentId = getParentId(node);
  if (!parentId) {
    return node;
  }

  const parentNode = findNodeById(allNodes, parentId);
  if (!parentNode) {
    const normalizedNode = {
      ...(node as NodeWithParent),
      parentId: undefined,
    };
    return normalizedNode as unknown as NodeType;
  }

  if (coordinateMode !== "absolute-v1") {
    return node;
  }

  return {
    ...node,
    position: toRelativePositionFromParentAbsolute(
      node.position,
      parentNode.position,
    ),
  };
}

export function serializeNodePosition(
  node: NodeType,
  allNodes: NodeType[],
): PositionType {
  return getNodeAbsolutePosition(node, allNodes);
}
