import {
  createAnchorNode,
  createExternalNode,
  createGroupNode,
  createPipelineNode,
  createStickerNode,
  ensureGroupNodeOrder,
  normalizeImportedNodePosition,
  type EdgeType,
  type NodeType,
  type PipelineNodeType,
} from "../../stores/flow";
import { NodeTypeEnum, SourceHandleTypeEnum } from "../../components/flow/nodes";
import {
  anchorMarkPrefix,
  externalMarkPrefix,
  groupMarkPrefix,
  stickerMarkPrefix,
  type IdLabelPairsType,
  type MpeConfigType,
  type PipelineConfigType,
} from "../../core/parser/types";
import { parsePipelineConfig, isMark } from "../../core/parser/configParser";
import { mergePipelineAndConfig } from "../../core/parser/configSplitter";
import { detectNodeVersion } from "../../core/parser/versionDetector";
import { parseNodeField } from "../../core/parser/nodeParser";
import {
  linkEdge,
  resetIdCounter,
  type NodeAttr,
  type NodeRefType,
} from "../../core/parser/edgeLinker";
import { rerouteEdgesToNearestReplica } from "../../core/parser/edgeRerouter";
import type { PipelineFlowProjection } from "./types";

export interface BuildPipelineProjectionOptions {
  pipeline: Record<string, unknown>;
  keyOrder?: string[];
  mpeConfig?: MpeConfigType;
}

export function buildPipelineProjection({
  pipeline,
  keyOrder,
  mpeConfig,
}: BuildPipelineProjectionOptions): PipelineFlowProjection {
  resetIdCounter();
  const originalKeys = keyOrder?.length ? keyOrder : Object.keys(pipeline);
  const pipelineObject = structuredClone(pipeline) as Record<string, any>;
  const merged = mpeConfig
    ? mergePipelineAndConfig(pipelineObject, mpeConfig, undefined, originalKeys)
    : pipelineObject;
  const configs = parsePipelineConfig(merged);
  const coordinateMode =
    (configs.coordinateMode as PipelineConfigType["coordinateMode"]) ??
    "relative-legacy";
  migrateLegacyFlowFields(merged, originalKeys);

  const state = createProjectionNodes(merged, originalKeys, configs);
  const nodesWithGroups = restoreGroupRelationships(state.nodes);
  let nodes = nodesWithGroups.map((node) =>
    normalizeImportedNodePosition(node, nodesWithGroups, coordinateMode),
  );
  nodes = ensureGroupNodeOrder(nodes);
  const linked = createProjectionEdges(
    merged,
    state.flowSourceKeys,
    state.flowSourceLabels,
    state.idLabelPairs,
  );
  nodes = [...nodes, ...linked.nodes];
  const edges = rerouteEdgesToNearestReplica(nodes, linked.edges);

  return {
    nodes,
    edges,
    hasAuthoredPositions: state.hasAuthoredPositions,
    config: {
      prefix: configs.prefix ?? "",
      coordinateMode: "absolute-v1",
      nodeOrderMap: state.orderMap,
      nextOrderNumber: state.nextOrderNumber,
    },
  };
}

interface ProjectionNodeState {
  nodes: NodeType[];
  flowSourceLabels: string[];
  flowSourceKeys: string[];
  idLabelPairs: IdLabelPairsType;
  hasAuthoredPositions: boolean;
  orderMap: Record<string, number>;
  nextOrderNumber: number;
}

function createProjectionNodes(
  pipeline: Record<string, any>,
  keys: string[],
  configs: PipelineConfigType,
): ProjectionNodeState {
  const nodes: NodeType[] = [];
  const flowSourceLabels: string[] = [];
  const flowSourceKeys: string[] = [];
  const idLabelPairs: IdLabelPairsType = [];
  const orderMap: Record<string, number> = {};
  let hasAuthoredPositions = false;
  let nextOrderNumber = 0;

  keys.forEach((sourceKey) => {
    const value = pipeline[sourceKey];
    if (isConfigSourceKey(sourceKey)) return;
    if (sourceKey.startsWith(stickerMarkPrefix)) {
      const node = createStickerProjection(sourceKey, value, configs);
      nodes.push(node);
      orderMap[node.id] = nextOrderNumber++;
      hasAuthoredPositions ||= Boolean(readMpeCode(value)?.position);
      return;
    }
    if (sourceKey.startsWith(groupMarkPrefix)) {
      const node = createGroupProjection(sourceKey, value, configs);
      nodes.push(node);
      orderMap[node.id] = nextOrderNumber++;
      hasAuthoredPositions ||= Boolean(readMpeCode(value)?.position);
      return;
    }
    if (sourceKey.startsWith("$") || !isRecord(value)) return;

    const { node, flowLabel, extraNodes, authoredPosition } = createFlowNode(
      sourceKey,
      value,
      configs,
    );
    nodes.push(node, ...extraNodes);
    flowSourceLabels.push(flowLabel);
    flowSourceKeys.push(sourceKey);
    idLabelPairs.push({ id: node.id, label: flowLabel });
    orderMap[node.id] = nextOrderNumber++;
    hasAuthoredPositions ||= authoredPosition;
  });

  return {
    nodes,
    flowSourceLabels,
    flowSourceKeys,
    idLabelPairs,
    hasAuthoredPositions,
    orderMap,
    nextOrderNumber,
  };
}

function createFlowNode(
  sourceKey: string,
  value: Record<string, any>,
  configs: PipelineConfigType,
): {
  node: PipelineNodeType;
  flowLabel: string;
  extraNodes: PipelineNodeType[];
  authoredPosition: boolean;
} {
  let type = NodeTypeEnum.Pipeline;
  let flowLabel = sourceKey;
  let displayLabel = sourceKey;
  if (sourceKey.startsWith(externalMarkPrefix)) {
    type = NodeTypeEnum.External;
    flowLabel = trimMetadataLabel(sourceKey, externalMarkPrefix, configs.filename);
    displayLabel = flowLabel;
  } else if (sourceKey.startsWith(anchorMarkPrefix)) {
    type = NodeTypeEnum.Anchor;
    flowLabel = trimMetadataLabel(sourceKey, anchorMarkPrefix, configs.filename);
    displayLabel = flowLabel;
  } else if (configs.prefix) {
    displayLabel = sourceKey.startsWith(`${configs.prefix}_`)
      ? sourceKey.slice(configs.prefix.length + 1)
      : sourceKey;
  }

  const id = stableNodeId(nodeIdPrefix(type), sourceKey);
  const node =
    type === NodeTypeEnum.Pipeline
      ? createPipelineNode(id, { label: displayLabel })
      : type === NodeTypeEnum.External
        ? (createExternalNode(id, { label: displayLabel }) as PipelineNodeType)
        : (createAnchorNode(id, { label: displayLabel }) as PipelineNodeType);
  const { recognitionVersion, actionVersion } = detectNodeVersion(value);
  let extraPositions: Array<{ x: number; y: number }> = [];
  let authoredPosition = false;

  Object.entries(value).forEach(([key, fieldValue]) => {
    if (isMark(key)) {
      if (isRecord(fieldValue) && isPosition(fieldValue.position)) {
        node.position = fieldValue.position;
        authoredPosition = true;
      }
      if (isRecord(fieldValue) && fieldValue.handleDirection) {
        node.data.handleDirection = fieldValue.handleDirection;
      }
      if (
        type !== NodeTypeEnum.Pipeline &&
        isRecord(fieldValue) &&
        Array.isArray(fieldValue.extra_positions)
      ) {
        extraPositions = fieldValue.extra_positions.filter(isPosition);
      }
      return;
    }
    let handled = false;
    try {
      handled = parseNodeField(
        node,
        key,
        fieldValue,
        recognitionVersion,
        actionVersion,
      );
    } catch {
      // Unsupported protocol values remain source-owned and must not abort
      // the safe partial projection.
    }
    if (!handled) node.data.extras[key] = fieldValue;
  });
  if (type === NodeTypeEnum.Pipeline) {
    node.data.recognition.param ??= {};
    node.data.action.param ??= {};
  }

  const extraNodes = extraPositions.map((position, index) => {
    const replicaId = `${nodeIdPrefix(type)}${stableHash(sourceKey)}_copy_${index}`;
    const replica =
      type === NodeTypeEnum.External
        ? (createExternalNode(replicaId, { label: displayLabel }) as PipelineNodeType)
        : (createAnchorNode(replicaId, { label: displayLabel }) as PipelineNodeType);
    replica.position = position;
    replica.data.handleDirection = node.data.handleDirection;
    return replica;
  });
  return { node, flowLabel, extraNodes, authoredPosition };
}

function createProjectionEdges(
  pipeline: Record<string, any>,
  sourceKeys: string[],
  sourceLabels: string[],
  initialPairs: IdLabelPairsType,
): { edges: EdgeType[]; nodes: NodeType[] } {
  let pairs = initialPairs;
  const edges: EdgeType[] = [];
  const nodes: NodeType[] = [];
  sourceKeys.forEach((sourceKey, index) => {
    const value = pipeline[sourceKey];
    if (!isRecord(value)) return;
    ([
      ["next", SourceHandleTypeEnum.Next],
      ["on_error", SourceHandleTypeEnum.Error],
    ] as const).forEach(([field, handle]) => {
      const references = normalizeReferences(value[field]);
      if (!references.length) return;
      const linked = linkEdge(sourceLabels[index], references, handle, pairs);
      edges.push(...linked[0]);
      nodes.push(...linked[1]);
      pairs = [...pairs, ...linked[2]];
    });
  });
  return { edges, nodes };
}

function restoreGroupRelationships(nodes: NodeType[]): NodeType[] {
  const labelToId = new Map(nodes.map((node) => [node.data.label, node.id]));
  const parentByChildId = new Map<string, string>();
  nodes.forEach((node) => {
    const children = (node as NodeType & { _pendingChildrenLabels?: string[] })
      ._pendingChildrenLabels;
    children?.forEach((label) => {
      const childId = labelToId.get(label);
      if (childId) parentByChildId.set(childId, node.id);
    });
  });
  return nodes.map((node) => {
    const clean = {
      ...node,
      ...(node.type !== NodeTypeEnum.Group && parentByChildId.has(node.id)
        ? { parentId: parentByChildId.get(node.id) }
        : {}),
    } as NodeType & { _pendingChildrenLabels?: string[] };
    delete clean._pendingChildrenLabels;
    return clean;
  });
}

function createStickerProjection(
  sourceKey: string,
  value: unknown,
  configs: PipelineConfigType,
): NodeType {
  const code = readMpeCode(value);
  const label = trimMetadataLabel(sourceKey, stickerMarkPrefix, configs.filename);
  return createStickerNode(stableNodeId("sticker_", sourceKey), {
    label,
    position: isPosition(code?.position) ? code.position : { x: 0, y: 0 },
    datas: {
      content: typeof code?.content === "string" ? code.content : "",
      color: code?.color ?? "yellow",
    },
    style: {
      ...(typeof code?.width === "number" ? { width: code.width } : {}),
      ...(typeof code?.height === "number" ? { height: code.height } : {}),
    },
  }) as unknown as NodeType;
}

function createGroupProjection(
  sourceKey: string,
  value: unknown,
  configs: PipelineConfigType,
): NodeType {
  const code = readMpeCode(value);
  const label = trimMetadataLabel(sourceKey, groupMarkPrefix, configs.filename);
  const node = createGroupNode(stableNodeId("group_", sourceKey), {
    label,
    position: isPosition(code?.position) ? code.position : { x: 0, y: 0 },
    datas: { color: code?.color ?? "blue" },
    style: {
      ...(typeof code?.width === "number" ? { width: code.width } : {}),
      ...(typeof code?.height === "number" ? { height: code.height } : {}),
    },
  }) as NodeType & { _pendingChildrenLabels?: string[] };
  if (Array.isArray(code?.childrenLabels)) {
    node._pendingChildrenLabels = code.childrenLabels.filter(
      (label): label is string => typeof label === "string",
    );
  }
  return node;
}

function migrateLegacyFlowFields(
  pipeline: Record<string, any>,
  keys: string[],
): void {
  const subNodes = new Set(
    keys.filter((key) => isRecord(pipeline[key]) && pipeline[key].is_sub === true),
  );
  keys.forEach((key) => {
    const node = pipeline[key];
    if (!isRecord(node)) return;
    if (node.interrupt) {
      const interrupts = normalizeReferences(node.interrupt).map((reference) =>
        typeof reference === "string"
          ? reference.startsWith("[JumpBack]")
            ? reference
            : `[JumpBack]${reference}`
          : { ...reference, jump_back: true },
      );
      node.next = [...normalizeReferences(node.next), ...interrupts];
    }
    (["next", "on_error"] as const).forEach((field) => {
      if (!node[field]) return;
      node[field] = normalizeReferences(node[field]).map((reference) => {
        if (typeof reference === "string") {
          return subNodes.has(reference) && !reference.startsWith("[JumpBack]")
            ? `[JumpBack]${reference}`
            : reference;
        }
        return subNodes.has(reference.name)
          ? { ...reference, jump_back: true }
          : reference;
      });
    });
    delete node.interrupt;
    delete node.is_sub;
  });
}

function normalizeReferences(value: unknown): NodeRefType[] {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return values.filter(
    (item): item is NodeRefType =>
      typeof item === "string" ||
      (isRecord(item) && typeof (item as NodeAttr).name === "string"),
  );
}

function readMpeCode(value: unknown): Record<string, any> | undefined {
  if (!isRecord(value)) return undefined;
  return isRecord(value.$__mpe_code) ? value.$__mpe_code : value;
}

function isConfigSourceKey(key: string): boolean {
  return (
    key.startsWith("$__mpe_config_") ||
    key.startsWith("__mpe_config_") ||
    key.startsWith("__yamaape_config_")
  );
}

function trimMetadataLabel(
  sourceKey: string,
  prefix: string,
  filename?: string,
): string {
  let label = sourceKey.slice(prefix.length);
  if (filename && label.endsWith(`_${filename}`)) {
    label = label.slice(0, -(filename.length + 1));
  }
  return label;
}

function nodeIdPrefix(type: NodeTypeEnum): string {
  if (type === NodeTypeEnum.External) return "e_";
  if (type === NodeTypeEnum.Anchor) return "a_";
  return "p_";
}

function stableNodeId(prefix: string, sourceKey: string): string {
  return `${prefix}${stableHash(sourceKey)}`;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPosition(value: unknown): value is { x: number; y: number } {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number"
  );
}
