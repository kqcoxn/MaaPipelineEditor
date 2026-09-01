export interface SequentialIdAllocation {
  id: string;
  sequence: number;
  nextCounter: number;
}

export interface SequentialIdAllocator {
  allocate: () => SequentialIdAllocation;
  getNextCounter: () => number;
}

function normalizeCounter(counter: number): number {
  return Number.isSafeInteger(counter) && counter > 0 ? counter : 1;
}

function parseSequence(id: string, prefix: string): number | undefined {
  if (!id.startsWith(prefix)) return undefined;

  const sequenceText = id.slice(prefix.length);
  if (!/^[1-9]\d*$/.test(sequenceText)) return undefined;

  const sequence = Number(sequenceText);
  return Number.isSafeInteger(sequence) ? sequence : undefined;
}

export function getNextSequentialIdCounter(
  prefix: string,
  ids: Iterable<string>,
  minimumCounter = 1,
): number {
  let nextCounter = normalizeCounter(minimumCounter);

  for (const id of ids) {
    const sequence = parseSequence(id, prefix);
    if (sequence !== undefined) {
      nextCounter = Math.max(nextCounter, sequence + 1);
    }
  }

  return nextCounter;
}

export function allocateSequentialId(
  prefix: string,
  hasId: (id: string) => boolean,
  startCounter: number,
): SequentialIdAllocation {
  let sequence = normalizeCounter(startCounter);
  let id = `${prefix}${sequence}`;

  while (hasId(id)) {
    sequence += 1;
    id = `${prefix}${sequence}`;
  }

  return {
    id,
    sequence,
    nextCounter: sequence + 1,
  };
}

export function createSequentialIdAllocator(
  prefix: string,
  existingIds: Iterable<string> = [],
  minimumCounter = 1,
): SequentialIdAllocator {
  const reservedIds = new Set(existingIds);
  let nextCounter = getNextSequentialIdCounter(
    prefix,
    reservedIds,
    minimumCounter,
  );

  return {
    allocate() {
      const allocation = allocateSequentialId(
        prefix,
        (id) => reservedIds.has(id),
        nextCounter,
      );
      reservedIds.add(allocation.id);
      nextCounter = allocation.nextCounter;
      return allocation;
    },
    getNextCounter() {
      return nextCounter;
    },
  };
}
