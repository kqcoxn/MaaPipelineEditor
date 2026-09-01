import {
  allocateSequentialId,
  createSequentialIdAllocator,
  getNextSequentialIdCounter,
  type SequentialIdAllocation,
  type SequentialIdAllocator,
} from "./sequentialId";

export const EDGE_ID_PREFIX = "edge_";

export type EdgeIdAllocation = SequentialIdAllocation;
export type EdgeIdAllocator = SequentialIdAllocator;

export function getNextEdgeIdCounter(
  edgeIds: Iterable<string>,
  minimumCounter = 1,
): number {
  return getNextSequentialIdCounter(
    EDGE_ID_PREFIX,
    edgeIds,
    minimumCounter,
  );
}

export function allocateEdgeId(
  hasEdgeId: (edgeId: string) => boolean,
  startCounter: number,
): EdgeIdAllocation {
  return allocateSequentialId(EDGE_ID_PREFIX, hasEdgeId, startCounter);
}

export function createEdgeIdAllocator(
  existingEdgeIds: Iterable<string> = [],
  minimumCounter = 1,
): EdgeIdAllocator {
  return createSequentialIdAllocator(
    EDGE_ID_PREFIX,
    existingEdgeIds,
    minimumCounter,
  );
}
