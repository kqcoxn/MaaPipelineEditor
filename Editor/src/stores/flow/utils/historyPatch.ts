import { cloneDeep, isEqual } from "lodash";

import type {
  EdgeType,
  FlowGraphHistoryPatch,
  FlowHistoryEntityPatch,
  NodeType,
} from "../types";

type HistoryEntity = NodeType | EdgeType;

function areNodesEqual(left: NodeType, right: NodeType): boolean {
  if (left === right) return true;

  const {
    selected: _leftSelected,
    dragging: _leftDragging,
    ...leftHistoryState
  } = left;
  const {
    selected: _rightSelected,
    dragging: _rightDragging,
    ...rightHistoryState
  } = right;
  return isEqual(leftHistoryState, rightHistoryState);
}

function areEdgesEqual(left: EdgeType, right: EdgeType): boolean {
  if (left === right) return true;

  const { selected: _leftSelected, ...leftHistoryState } = left;
  const { selected: _rightSelected, ...rightHistoryState } = right;
  return isEqual(leftHistoryState, rightHistoryState);
}

function cloneNode(node: NodeType): NodeType {
  const cloned = cloneDeep(node);
  delete cloned.selected;
  delete cloned.dragging;
  return cloned;
}

function cloneEdge(edge: EdgeType): EdgeType {
  const cloned = cloneDeep(edge);
  delete cloned.selected;
  return cloned;
}

function findStableIds(
  previousIndexById: ReadonlyMap<string, number>,
  nextIds: string[],
): Set<string> {
  const commonIds = nextIds.filter((id) => previousIndexById.has(id));
  const sequence = commonIds.map((id) => previousIndexById.get(id)!);
  const tails: number[] = [];
  const tailPositions: number[] = [];
  const predecessors = new Array<number>(sequence.length).fill(-1);

  for (let index = 0; index < sequence.length; index += 1) {
    const value = sequence[index];
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (tails[middle] < value) low = middle + 1;
      else high = middle;
    }

    if (low > 0) predecessors[index] = tailPositions[low - 1];
    tails[low] = value;
    tailPositions[low] = index;
  }

  const stableIds = new Set<string>();
  let current = tailPositions[tails.length - 1] ?? -1;
  while (current >= 0) {
    stableIds.add(commonIds[current]);
    current = predecessors[current];
  }
  return stableIds;
}

function createEntityPatches<T extends HistoryEntity>(
  before: T[],
  after: T[],
  areEqual: (left: T, right: T) => boolean,
  clone: (value: T) => T,
): FlowHistoryEntityPatch<T>[] {
  const beforeById = new Map(
    before.map((value, index) => [value.id, { value, index }]),
  );
  const afterById = new Map(
    after.map((value, index) => [value.id, { value, index }]),
  );
  const stableIds = findStableIds(
    new Map(before.map((value, index) => [value.id, index])),
    after.map((value) => value.id),
  );
  const ids = new Set([...beforeById.keys(), ...afterById.keys()]);
  const patches: FlowHistoryEntityPatch<T>[] = [];

  for (const id of ids) {
    const previous = beforeById.get(id);
    const next = afterById.get(id);
    const moved = Boolean(previous && next && !stableIds.has(id));
    const contentChanged =
      !previous || !next || !areEqual(previous.value, next.value);
    if (!moved && !contentChanged) continue;

    if (previous && next && !contentChanged) {
      const sharedValue = clone(previous.value);
      patches.push({
        id,
        before: sharedValue,
        after: sharedValue,
        beforeIndex: previous.index,
        afterIndex: next.index,
        moved,
      });
      continue;
    }

    patches.push({
      id,
      before: previous ? clone(previous.value) : null,
      after: next ? clone(next.value) : null,
      beforeIndex: previous?.index ?? -1,
      afterIndex: next?.index ?? -1,
      moved,
    });
  }

  return patches;
}

function applyEntityPatches<T extends HistoryEntity>(
  current: T[],
  patches: FlowHistoryEntityPatch<T>[],
  direction: "undo" | "redo",
  clone: (value: T) => T,
): T[] {
  const patchById = new Map(patches.map((patch) => [patch.id, patch]));
  const targetKey = direction === "undo" ? "before" : "after";
  const targetIndexKey =
    direction === "undo" ? "beforeIndex" : "afterIndex";
  const sourceKey = direction === "undo" ? "after" : "before";

  const result = current.flatMap((value) => {
    const patch = patchById.get(value.id);
    if (!patch) return [value];

    const target = patch[targetKey];
    const source = patch[sourceKey];
    if (!target || patch.moved || !source) return [];
    return [clone(target)];
  });

  const insertions = patches
    .filter((patch) => {
      const target = patch[targetKey];
      const source = patch[sourceKey];
      return Boolean(target && (patch.moved || !source));
    })
    .sort((left, right) => left[targetIndexKey] - right[targetIndexKey]);

  for (const patch of insertions) {
    const target = patch[targetKey];
    if (!target) continue;
    result.splice(patch[targetIndexKey], 0, clone(target));
  }

  return result;
}

export function createGraphHistoryPatch(
  beforeNodes: NodeType[],
  beforeEdges: EdgeType[],
  afterNodes: NodeType[],
  afterEdges: EdgeType[],
): FlowGraphHistoryPatch {
  return {
    nodes: createEntityPatches(
      beforeNodes,
      afterNodes,
      areNodesEqual,
      cloneNode,
    ),
    edges: createEntityPatches(
      beforeEdges,
      afterEdges,
      areEdgesEqual,
      cloneEdge,
    ),
  };
}

export function hasGraphHistoryChanges(
  patch: FlowGraphHistoryPatch,
): boolean {
  return patch.nodes.length > 0 || patch.edges.length > 0;
}

export function applyGraphHistoryPatch(
  nodes: NodeType[],
  edges: EdgeType[],
  patch: FlowGraphHistoryPatch,
  direction: "undo" | "redo",
): { nodes: NodeType[]; edges: EdgeType[] } {
  return {
    nodes: applyEntityPatches(nodes, patch.nodes, direction, cloneNode),
    edges: applyEntityPatches(edges, patch.edges, direction, cloneEdge),
  };
}
