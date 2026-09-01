export const NODE_ID_PREFIX = "node_";

export interface NodeIdAllocation {
  id: string;
  sequence: number;
  nextCounter: number;
}

export interface NodeIdAllocator {
  allocate: () => NodeIdAllocation;
  getNextCounter: () => number;
}

function normalizeCounter(counter: number): number {
  return Number.isSafeInteger(counter) && counter > 0 ? counter : 1;
}

function parseNodeIdSequence(nodeId: string): number | undefined {
  if (!nodeId.startsWith(NODE_ID_PREFIX)) return undefined;

  const sequenceText = nodeId.slice(NODE_ID_PREFIX.length);
  if (!/^[1-9]\d*$/.test(sequenceText)) return undefined;

  const sequence = Number(sequenceText);
  return Number.isSafeInteger(sequence) && sequence > 0
    ? sequence
    : undefined;
}

export function getNextNodeIdCounter(
  nodeIds: Iterable<string>,
  minimumCounter = 1,
): number {
  let nextCounter = normalizeCounter(minimumCounter);

  for (const nodeId of nodeIds) {
    const sequence = parseNodeIdSequence(nodeId);
    if (sequence !== undefined) {
      nextCounter = Math.max(nextCounter, sequence + 1);
    }
  }

  return nextCounter;
}

export function allocateNodeId(
  hasNodeId: (nodeId: string) => boolean,
  startCounter: number,
): NodeIdAllocation {
  let sequence = normalizeCounter(startCounter);
  let id = `${NODE_ID_PREFIX}${sequence}`;

  while (hasNodeId(id)) {
    sequence += 1;
    id = `${NODE_ID_PREFIX}${sequence}`;
  }

  return {
    id,
    sequence,
    nextCounter: sequence + 1,
  };
}

export function createNodeIdAllocator(
  existingNodeIds: Iterable<string> = [],
  minimumCounter = 1,
): NodeIdAllocator {
  const reservedNodeIds = new Set(existingNodeIds);
  let nextCounter = getNextNodeIdCounter(reservedNodeIds, minimumCounter);

  return {
    allocate() {
      const allocation = allocateNodeId(
        (nodeId) => reservedNodeIds.has(nodeId),
        nextCounter,
      );
      reservedNodeIds.add(allocation.id);
      nextCounter = allocation.nextCounter;
      return allocation;
    },
    getNextCounter() {
      return nextCounter;
    },
  };
}
