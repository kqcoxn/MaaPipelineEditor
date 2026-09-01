import { NodeTypeEnum } from "../../../components/flow/nodes";
import type {
  EdgeType,
  FlowGraphIndexState,
  NodeSemanticSummary,
  NodeType,
  PipelineNodeType,
} from "../types";

type NodeIndexState = Pick<
  FlowGraphIndexState,
  | "nodeById"
  | "nodeSemanticById"
  | "nodeIdsByTypeAndLabel"
  | "anchorReferenceIndex"
>;

type EdgeIndexState = Pick<
  FlowGraphIndexState,
  | "edgeById"
  | "outgoingEdgeIdsByNodeId"
  | "incomingEdgeIdsByNodeId"
>;

type RevisionState = Pick<
  FlowGraphIndexState,
  | "graphRevision"
  | "layoutRevision"
  | "topologyRevision"
  | "semanticRevision"
  | "selectionRevision"
>;

type SelectionIndexState = Pick<
  FlowGraphIndexState,
  | "selectedNodeIds"
  | "selectedEdgeIds"
  | "selectedEdgeEndpointNodeIds"
  | "hasSelectedSticker"
  | "selectionRevision"
>;

export interface NodeIndexPatch {
  previous?: NodeType;
  next?: NodeType;
  semanticChanged?: boolean;
}

export interface EdgeIndexPatch {
  previous?: EdgeType;
  next?: EdgeType;
}

export interface GraphRevisionChanges {
  layout?: boolean;
  topology?: boolean;
  semantic?: boolean;
  selection?: boolean;
}

function toNodeSemanticSummary(node: NodeType): NodeSemanticSummary {
  return {
    id: node.id,
    type: node.type,
    label: node.data.label,
  };
}

export function getNodeTypeLabelKey(
  type: NodeTypeEnum,
  label: string,
): string {
  return `${type}\u0000${label}`;
}

function extractAnchorNames(node: NodeType | undefined): Set<string> {
  if (node?.type !== NodeTypeEnum.Pipeline) return new Set();
  const anchorValue = (node as PipelineNodeType).data.others?.anchor;

  if (typeof anchorValue === "string") {
    const name = anchorValue.trim();
    return name ? new Set([name]) : new Set();
  }
  if (Array.isArray(anchorValue)) {
    return new Set(
      anchorValue
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    );
  }
  if (anchorValue && typeof anchorValue === "object") {
    return new Set(Object.keys(anchorValue).map((name) => name.trim()).filter(Boolean));
  }
  return new Set();
}

function updateSetMap(
  source: Map<string, Set<string>>,
  key: string,
  value: string,
  operation: "add" | "delete",
): Map<string, Set<string>> {
  const result = new Map(source);
  const values = new Set(result.get(key));
  if (operation === "add") {
    values.add(value);
    result.set(key, values);
  } else {
    values.delete(value);
    if (values.size > 0) result.set(key, values);
    else result.delete(key);
  }
  return result;
}

function updateIdListMap(
  source: Map<string, string[]>,
  key: string,
  value: string,
  operation: "add" | "delete",
): Map<string, string[]> {
  const result = new Map(source);
  const current = result.get(key) ?? [];
  if (operation === "add") {
    if (!current.includes(value)) result.set(key, [...current, value]);
  } else {
    const next = current.filter((item) => item !== value);
    if (next.length > 0) result.set(key, next);
    else result.delete(key);
  }
  return result;
}

export function buildNodeIndexes(nodes: NodeType[]): NodeIndexState {
  const nodeById = new Map<string, NodeType>();
  const nodeSemanticById = new Map<string, NodeSemanticSummary>();
  const nodeIdsByTypeAndLabel = new Map<string, Set<string>>();
  const anchorReferenceIndex = new Map<string, Set<string>>();

  for (const node of nodes) {
    nodeById.set(node.id, node);
    nodeSemanticById.set(node.id, toNodeSemanticSummary(node));

    const typeLabelKey = getNodeTypeLabelKey(node.type, node.data.label);
    const replicaIds = nodeIdsByTypeAndLabel.get(typeLabelKey) ?? new Set();
    replicaIds.add(node.id);
    nodeIdsByTypeAndLabel.set(typeLabelKey, replicaIds);

    for (const anchorName of extractAnchorNames(node)) {
      const referenceIds = anchorReferenceIndex.get(anchorName) ?? new Set();
      referenceIds.add(node.id);
      anchorReferenceIndex.set(anchorName, referenceIds);
    }
  }

  return {
    nodeById,
    nodeSemanticById,
    nodeIdsByTypeAndLabel,
    anchorReferenceIndex,
  };
}

export function patchNodeIndexes(
  state: NodeIndexState,
  patches: NodeIndexPatch[],
): NodeIndexState {
  if (patches.length === 0) return state;

  const nodeById = new Map(state.nodeById);
  let nodeSemanticById = state.nodeSemanticById;
  let nodeIdsByTypeAndLabel = state.nodeIdsByTypeAndLabel;
  let anchorReferenceIndex = state.anchorReferenceIndex;
  let semanticMapCloned = false;

  for (const patch of patches) {
    if (patch.previous) nodeById.delete(patch.previous.id);
    if (patch.next) nodeById.set(patch.next.id, patch.next);
    if (!patch.semanticChanged) continue;

    if (!semanticMapCloned) {
      nodeSemanticById = new Map(nodeSemanticById);
      semanticMapCloned = true;
    }
    if (patch.previous) nodeSemanticById.delete(patch.previous.id);
    if (patch.next) {
      nodeSemanticById.set(patch.next.id, toNodeSemanticSummary(patch.next));
    }

    const previousKey = patch.previous
      ? getNodeTypeLabelKey(patch.previous.type, patch.previous.data.label)
      : undefined;
    const nextKey = patch.next
      ? getNodeTypeLabelKey(patch.next.type, patch.next.data.label)
      : undefined;
    if (
      previousKey !== nextKey ||
      patch.previous?.id !== patch.next?.id
    ) {
      if (previousKey && patch.previous) {
        nodeIdsByTypeAndLabel = updateSetMap(
          nodeIdsByTypeAndLabel,
          previousKey,
          patch.previous.id,
          "delete",
        );
      }
      if (nextKey && patch.next) {
        nodeIdsByTypeAndLabel = updateSetMap(
          nodeIdsByTypeAndLabel,
          nextKey,
          patch.next.id,
          "add",
        );
      }
    }

    const previousAnchors = extractAnchorNames(patch.previous);
    const nextAnchors = extractAnchorNames(patch.next);
    for (const anchorName of previousAnchors) {
      if (
        (!nextAnchors.has(anchorName) ||
          patch.previous?.id !== patch.next?.id) &&
        patch.previous
      ) {
        anchorReferenceIndex = updateSetMap(
          anchorReferenceIndex,
          anchorName,
          patch.previous.id,
          "delete",
        );
      }
    }
    for (const anchorName of nextAnchors) {
      if (
        (!previousAnchors.has(anchorName) ||
          patch.previous?.id !== patch.next?.id) &&
        patch.next
      ) {
        anchorReferenceIndex = updateSetMap(
          anchorReferenceIndex,
          anchorName,
          patch.next.id,
          "add",
        );
      }
    }
  }

  return {
    nodeById,
    nodeSemanticById,
    nodeIdsByTypeAndLabel,
    anchorReferenceIndex,
  };
}

export function buildEdgeIndexes(edges: EdgeType[]): EdgeIndexState {
  const edgeById = new Map<string, EdgeType>();
  const outgoingEdgeIdsByNodeId = new Map<string, string[]>();
  const incomingEdgeIdsByNodeId = new Map<string, string[]>();

  for (const edge of edges) {
    edgeById.set(edge.id, edge);
    const outgoing = outgoingEdgeIdsByNodeId.get(edge.source) ?? [];
    outgoing.push(edge.id);
    outgoingEdgeIdsByNodeId.set(edge.source, outgoing);
    const incoming = incomingEdgeIdsByNodeId.get(edge.target) ?? [];
    incoming.push(edge.id);
    incomingEdgeIdsByNodeId.set(edge.target, incoming);
  }

  return { edgeById, outgoingEdgeIdsByNodeId, incomingEdgeIdsByNodeId };
}

export function patchEdgeIndexes(
  state: EdgeIndexState,
  patches: EdgeIndexPatch[],
): EdgeIndexState {
  if (patches.length === 0) return state;

  const edgeById = new Map(state.edgeById);
  let outgoingEdgeIdsByNodeId = state.outgoingEdgeIdsByNodeId;
  let incomingEdgeIdsByNodeId = state.incomingEdgeIdsByNodeId;

  for (const patch of patches) {
    if (patch.previous) edgeById.delete(patch.previous.id);
    if (patch.next) edgeById.set(patch.next.id, patch.next);

    const endpointsChanged =
      !patch.previous ||
      !patch.next ||
      patch.previous.id !== patch.next.id ||
      patch.previous.source !== patch.next.source ||
      patch.previous.target !== patch.next.target;
    if (!endpointsChanged) continue;

    if (patch.previous) {
      outgoingEdgeIdsByNodeId = updateIdListMap(
        outgoingEdgeIdsByNodeId,
        patch.previous.source,
        patch.previous.id,
        "delete",
      );
      incomingEdgeIdsByNodeId = updateIdListMap(
        incomingEdgeIdsByNodeId,
        patch.previous.target,
        patch.previous.id,
        "delete",
      );
    }
    if (patch.next) {
      outgoingEdgeIdsByNodeId = updateIdListMap(
        outgoingEdgeIdsByNodeId,
        patch.next.source,
        patch.next.id,
        "add",
      );
      incomingEdgeIdsByNodeId = updateIdListMap(
        incomingEdgeIdsByNodeId,
        patch.next.target,
        patch.next.id,
        "add",
      );
    }
  }

  return { edgeById, outgoingEdgeIdsByNodeId, incomingEdgeIdsByNodeId };
}

function areSetsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

export function buildSelectionIndexUpdate(
  state: SelectionIndexState,
  nodes: NodeType[],
  edges: EdgeType[],
): Partial<FlowGraphIndexState> {
  const selectedNodeIds = new Set(nodes.map((node) => node.id));
  const selectedEdgeIds = new Set(edges.map((edge) => edge.id));
  const selectedEdgeEndpointNodeIds = new Set<string>();
  for (const edge of edges) {
    selectedEdgeEndpointNodeIds.add(edge.source);
    selectedEdgeEndpointNodeIds.add(edge.target);
  }
  const hasSelectedSticker = nodes.some(
    (node) => node.type === NodeTypeEnum.Sticker,
  );
  const changed =
    !areSetsEqual(state.selectedNodeIds, selectedNodeIds) ||
    !areSetsEqual(state.selectedEdgeIds, selectedEdgeIds) ||
    !areSetsEqual(
      state.selectedEdgeEndpointNodeIds,
      selectedEdgeEndpointNodeIds,
    ) ||
    state.hasSelectedSticker !== hasSelectedSticker;

  if (!changed) return {};
  return {
    selectedNodeIds,
    selectedEdgeIds,
    selectedEdgeEndpointNodeIds,
    hasSelectedSticker,
    selectionRevision: state.selectionRevision + 1,
  };
}

export function bumpGraphRevisions(
  state: RevisionState,
  changes: GraphRevisionChanges,
): Partial<FlowGraphIndexState> {
  const hasGraphChange =
    changes.layout || changes.topology || changes.semantic;
  return {
    ...(hasGraphChange
      ? { graphRevision: state.graphRevision + 1 }
      : {}),
    ...(changes.layout
      ? { layoutRevision: state.layoutRevision + 1 }
      : {}),
    ...(changes.topology
      ? { topologyRevision: state.topologyRevision + 1 }
      : {}),
    ...(changes.semantic
      ? { semanticRevision: state.semanticRevision + 1 }
      : {}),
    ...(changes.selection
      ? { selectionRevision: state.selectionRevision + 1 }
      : {}),
  };
}

export function createNodeIndexPatches(
  previousNodes: NodeType[],
  nextNodes: NodeType[],
): NodeIndexPatch[] {
  const previousById = new Map(previousNodes.map((node) => [node.id, node]));
  const nextById = new Map(nextNodes.map((node) => [node.id, node]));
  const ids = new Set([...previousById.keys(), ...nextById.keys()]);
  const patches: NodeIndexPatch[] = [];
  for (const id of ids) {
    const previous = previousById.get(id);
    const next = nextById.get(id);
    if (previous === next) continue;
    patches.push({ previous, next, semanticChanged: true });
  }
  return patches;
}

export function createNodeIndexPatchesForIds(
  previousById: ReadonlyMap<string, NodeType>,
  nextNodes: NodeType[],
  affectedIds: Set<string>,
  semanticNodeIds: Set<string>,
): NodeIndexPatch[] {
  if (affectedIds.size === 0) return [];

  const nextById = new Map<string, NodeType>();
  if (affectedIds.size <= 4) {
    for (const id of affectedIds) {
      const node = nextNodes.find((candidate) => candidate.id === id);
      if (node) nextById.set(id, node);
    }
  } else {
    for (const node of nextNodes) {
      if (affectedIds.has(node.id)) nextById.set(node.id, node);
    }
  }

  const patches: NodeIndexPatch[] = [];
  for (const id of affectedIds) {
    const previous = previousById.get(id);
    const next = nextById.get(id);
    if (previous === next) continue;
    patches.push({
      previous,
      next,
      semanticChanged: semanticNodeIds.has(id),
    });
  }
  return patches;
}

export function createEdgeIndexPatches(
  previousEdges: EdgeType[],
  nextEdges: EdgeType[],
): EdgeIndexPatch[] {
  const previousById = new Map(previousEdges.map((edge) => [edge.id, edge]));
  const nextById = new Map(nextEdges.map((edge) => [edge.id, edge]));
  const ids = new Set([...previousById.keys(), ...nextById.keys()]);
  const patches: EdgeIndexPatch[] = [];
  for (const id of ids) {
    const previous = previousById.get(id);
    const next = nextById.get(id);
    if (previous === next) continue;
    patches.push({ previous, next });
  }
  return patches;
}
