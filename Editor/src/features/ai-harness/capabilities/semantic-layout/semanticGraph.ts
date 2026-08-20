import { NodeTypeEnum } from "@/components/flow/nodes/constants";
import type { NodeType } from "@/stores/flow";
import type { CanvasGraphState } from "../canvas/commandBus";
import type {
  SemanticCandidateSet,
  SemanticControlEdge,
  SemanticLayoutContext,
  SemanticNodeReference,
} from "./types";

const REFERENCE_FIELDS = new Set([
  "all_of",
  "any_of",
  "begin",
  "color_filter",
  "end",
  "roi",
  "target",
]);

type NodeWithParent = NodeType & { parentId?: string };

export function isSemanticLayoutNode(node: NodeType): boolean {
  return (
    node.type !== NodeTypeEnum.Group &&
    node.type !== NodeTypeEnum.Sticker &&
    !(node as NodeWithParent).parentId
  );
}

export function buildSemanticLayoutContext(
  graph: CanvasGraphState,
  stateVersion: number,
): SemanticLayoutContext {
  const layoutableNodes = graph.nodes.filter(isSemanticLayoutNode);
  const layoutableNodeIds = new Set(layoutableNodes.map((node) => node.id));
  const controlEdges = graph.edges
    .filter(
      (edge) =>
        layoutableNodeIds.has(edge.source) && layoutableNodeIds.has(edge.target),
    )
    .map<SemanticControlEdge>((edge) => {
      const jumpBack =
        edge.targetHandle === "jump_back" || edge.attributes?.jump_back === true;
      return {
        id: edge.id,
        sourceId: edge.source,
        targetId: edge.target,
        kind:
          edge.sourceHandle === "on_error"
            ? "on_error"
            : jumpBack
              ? "jump_back"
              : "next",
        order: edge.label,
        returnsToSource: jumpBack && edge.sourceHandle !== "on_error",
      };
    });
  const incomingCount = new Map(layoutableNodes.map((node) => [node.id, 0]));
  controlEdges.forEach((edge) => {
    if (edge.kind === "next") {
      incomingCount.set(edge.targetId, (incomingCount.get(edge.targetId) ?? 0) + 1);
    }
  });

  return {
    fileName: graph.fileName,
    stateVersion,
    layoutableNodeIds: [...layoutableNodeIds],
    excludedNodeIds: graph.nodes
      .filter((node) => !layoutableNodeIds.has(node.id))
      .map((node) => node.id),
    nodes: layoutableNodes.map((node) => ({
      id: node.id,
      name: node.data.label,
      type: node.type,
      ...readPipelineKinds(node),
      width: node.measured?.width ?? 200,
      height: node.measured?.height ?? 100,
      entry: (incomingCount.get(node.id) ?? 0) === 0,
    })),
    controlEdges,
    candidateSets: buildCandidateSets(controlEdges),
    stronglyConnectedComponents: findStronglyConnectedComponents(
      [...layoutableNodeIds],
      controlEdges,
    ),
    references: collectNodeReferences(layoutableNodes),
  };
}

function readPipelineKinds(
  node: NodeType,
): { recognition?: string; action?: string } {
  if (node.type !== NodeTypeEnum.Pipeline) return {};
  return {
    recognition: node.data.recognition.type,
    action: node.data.action.type,
  };
}

function buildCandidateSets(
  edges: SemanticControlEdge[],
): SemanticCandidateSet[] {
  const groups = new Map<string, SemanticCandidateSet>();
  edges.forEach((edge) => {
    const kind = edge.kind === "on_error" ? "on_error" : "next";
    const key = `${edge.sourceId}:${kind}`;
    const group = groups.get(key) ?? {
      sourceId: edge.sourceId,
      kind,
      candidates: [],
    };
    group.candidates.push({
      nodeId: edge.targetId,
      order: edge.order,
      jumpBack: edge.kind === "jump_back",
    });
    groups.set(key, group);
  });
  return [...groups.values()].map((group) => ({
    ...group,
    candidates: [...group.candidates].sort(
      (left, right) => left.order - right.order,
    ),
  }));
}

function findStronglyConnectedComponents(
  nodeIds: string[],
  edges: SemanticControlEdge[],
): string[][] {
  const adjacency = new Map(nodeIds.map((nodeId) => [nodeId, [] as string[]]));
  edges.forEach((edge) => adjacency.get(edge.sourceId)?.push(edge.targetId));
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const inStack = new Set<string>();
  const components: string[][] = [];
  let index = 0;

  const visit = (nodeId: string) => {
    indices.set(nodeId, index);
    lowLinks.set(nodeId, index);
    index += 1;
    stack.push(nodeId);
    inStack.add(nodeId);

    for (const targetId of adjacency.get(nodeId) ?? []) {
      if (!indices.has(targetId)) {
        visit(targetId);
        lowLinks.set(
          nodeId,
          Math.min(lowLinks.get(nodeId)!, lowLinks.get(targetId)!),
        );
      } else if (inStack.has(targetId)) {
        lowLinks.set(
          nodeId,
          Math.min(lowLinks.get(nodeId)!, indices.get(targetId)!),
        );
      }
    }

    if (lowLinks.get(nodeId) !== indices.get(nodeId)) return;
    const component: string[] = [];
    let currentId: string;
    do {
      currentId = stack.pop()!;
      inStack.delete(currentId);
      component.push(currentId);
    } while (currentId !== nodeId);
    if (
      component.length > 1 ||
      (adjacency.get(nodeId) ?? []).includes(nodeId)
    ) {
      components.push(component);
    }
  };

  nodeIds.forEach((nodeId) => {
    if (!indices.has(nodeId)) visit(nodeId);
  });
  return components;
}

function collectNodeReferences(nodes: NodeType[]): SemanticNodeReference[] {
  const labelToIds = new Map<string, string[]>();
  nodes.forEach((node) => {
    labelToIds.set(node.data.label, [
      ...(labelToIds.get(node.data.label) ?? []),
      node.id,
    ]);
  });
  return nodes.flatMap((node) => {
    if (node.type !== NodeTypeEnum.Pipeline) return [];
    return collectReferencesFromValue(node.id, node.data, labelToIds);
  });
}

function collectReferencesFromValue(
  sourceId: string,
  value: unknown,
  labelToIds: Map<string, string[]>,
  field = "",
): SemanticNodeReference[] {
  if (typeof value === "string") {
    if (!REFERENCE_FIELDS.has(field)) return [];
    const dynamicAnchor = value.startsWith("[Anchor]");
    const normalizedReference = dynamicAnchor ? value.slice(8) : value;
    const targetNodeIds = dynamicAnchor
      ? []
      : (labelToIds.get(normalizedReference) ?? []);
    if (!dynamicAnchor && targetNodeIds.length === 0) return [];
    return [
      {
        sourceId,
        field,
        reference: value,
        targetNodeIds,
        dynamicAnchor,
      },
    ];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) =>
      collectReferencesFromValue(sourceId, item, labelToIds, field),
    );
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) =>
    collectReferencesFromValue(sourceId, child, labelToIds, key),
  );
}
