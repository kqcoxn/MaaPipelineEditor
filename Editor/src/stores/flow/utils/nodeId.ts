import {
  allocateSequentialId,
  createSequentialIdAllocator,
  getNextSequentialIdCounter,
  type SequentialIdAllocation,
  type SequentialIdAllocator,
} from "./sequentialId";

export const NODE_ID_PREFIX = "node_";

export type NodeIdAllocation = SequentialIdAllocation;
export type NodeIdAllocator = SequentialIdAllocator;

export function getNextNodeIdCounter(
  nodeIds: Iterable<string>,
  minimumCounter = 1,
): number {
  return getNextSequentialIdCounter(
    NODE_ID_PREFIX,
    nodeIds,
    minimumCounter,
  );
}

export function allocateNodeId(
  hasNodeId: (nodeId: string) => boolean,
  startCounter: number,
): NodeIdAllocation {
  return allocateSequentialId(NODE_ID_PREFIX, hasNodeId, startCounter);
}

export function createNodeIdAllocator(
  existingNodeIds: Iterable<string> = [],
  minimumCounter = 1,
): NodeIdAllocator {
  return createSequentialIdAllocator(
    NODE_ID_PREFIX,
    existingNodeIds,
    minimumCounter,
  );
}
