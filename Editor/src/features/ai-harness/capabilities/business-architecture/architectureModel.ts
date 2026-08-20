import type { NodeType } from "@/stores/flow";
import type { CanvasGraphState } from "../canvas/commandBus";
import {
  buildSemanticLayoutContext,
  isSemanticLayoutNode,
} from "../semantic-layout/semanticGraph";
import type {
  BusinessArchitectureContext,
  BusinessArchitectureDocument,
  BusinessArchitectureIntent,
  BusinessArchitectureStageIntent,
  BusinessArchitectureTransition,
  BusinessTransitionKind,
} from "./types";

const CUE_FIELDS = [
  "expected",
  "template",
  "custom_recognition",
  "custom_action",
  "package",
  "input_text",
  "key",
  "command",
  "shell",
] as const;
const BUSINESS_HINT_FIELDS = ["business", "description", "summary", "title"];

export class BusinessArchitectureError extends Error {}

export function buildBusinessArchitectureContext(
  graph: CanvasGraphState,
  stateVersion: number,
): BusinessArchitectureContext {
  const semanticContext = buildSemanticLayoutContext(graph, stateVersion);
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  return {
    ...semanticContext,
    sourceSignature: buildBusinessArchitectureSourceSignature(graph),
    nodes: semanticContext.nodes.map((node) => {
      const sourceNode = nodeMap.get(node.id);
      return {
        ...node,
        recognitionSummary: summarizePipelineSection(
          sourceNode,
          "recognition",
        ),
        actionSummary: summarizePipelineSection(sourceNode, "action"),
        businessHint: readBusinessHint(sourceNode),
      };
    }),
  };
}

export function buildBusinessArchitectureDocument(
  graph: CanvasGraphState,
  stateVersion: number,
  intent: BusinessArchitectureIntent,
  sourceRunId: string,
): BusinessArchitectureDocument {
  const context = buildBusinessArchitectureContext(graph, stateVersion);
  if (context.layoutableNodeIds.length === 0) {
    throw new BusinessArchitectureError("当前画布没有可梳理的流程节点");
  }
  const { stages, autoAssignedNodeIds } = normalizeStages(
    context.layoutableNodeIds,
    intent.stages,
  );
  return {
    title: intent.title.trim(),
    summary: intent.summary.trim(),
    stages,
    transitions: deriveStageTransitions(context, stages),
    fileName: graph.fileName,
    sourceRunId,
    sourceStateVersion: stateVersion,
    sourceSignature: context.sourceSignature,
    generatedAt: Date.now(),
    coverage: {
      includedNodeCount: context.layoutableNodeIds.length,
      totalNodeCount: context.layoutableNodeIds.length,
      autoAssignedNodeIds,
    },
  };
}

export function buildBusinessArchitectureSourceSignature(
  graph: CanvasGraphState,
): string {
  const context = buildSemanticLayoutContext(graph, 0);
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const nodes = context.nodes
    .map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      recognition: node.recognition,
      action: node.action,
      recognitionSummary: summarizePipelineSection(
        nodeMap.get(node.id),
        "recognition",
      ),
      actionSummary: summarizePipelineSection(
        nodeMap.get(node.id),
        "action",
      ),
      businessHint: readBusinessHint(nodeMap.get(node.id)),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const edges = context.controlEdges
    .map(({ sourceId, targetId, kind, order }) => ({
      sourceId,
      targetId,
      kind,
      order,
    }))
    .sort((left, right) =>
      `${left.sourceId}\u0000${left.targetId}\u0000${left.kind}\u0000${left.order}`.localeCompare(
        `${right.sourceId}\u0000${right.targetId}\u0000${right.kind}\u0000${right.order}`,
      ),
    );
  return JSON.stringify({ nodes, edges });
}

function normalizeStages(
  validNodeIds: string[],
  requestedStages: BusinessArchitectureStageIntent[],
): { stages: BusinessArchitectureStageIntent[]; autoAssignedNodeIds: string[] } {
  const validIds = new Set(validNodeIds);
  const stageIds = new Set<string>();
  const assignedIds = new Set<string>();
  const stages = requestedStages.map((stage) => {
    const id = stage.id.trim();
    if (stageIds.has(id)) {
      throw new BusinessArchitectureError(`业务阶段 ID 重复: ${id}`);
    }
    stageIds.add(id);
    const nodeIds = stage.nodeIds.map((nodeId) => nodeId.trim());
    nodeIds.forEach((nodeId) => {
      if (!validIds.has(nodeId)) {
        throw new BusinessArchitectureError(`业务阶段引用了不可用节点: ${nodeId}`);
      }
      if (assignedIds.has(nodeId)) {
        throw new BusinessArchitectureError(`节点被分配到多个业务阶段: ${nodeId}`);
      }
      assignedIds.add(nodeId);
    });
    return {
      ...stage,
      id,
      title: stage.title.trim(),
      description: stage.description.trim(),
      nodeIds,
    };
  });
  const autoAssignedNodeIds = validNodeIds.filter(
    (nodeId) => !assignedIds.has(nodeId),
  );
  if (autoAssignedNodeIds.length > 0) {
    const supportStage = stages.find((stage) => stage.kind === "support");
    if (supportStage) {
      supportStage.nodeIds = [...supportStage.nodeIds, ...autoAssignedNodeIds];
    } else {
      stages.push({
        id: createUniqueStageId(stageIds, "unclassified"),
        title: "待梳理",
        description: "尚未归入明确业务阶段的流程节点。",
        kind: "support",
        nodeIds: autoAssignedNodeIds,
      });
    }
  }
  return { stages, autoAssignedNodeIds };
}

function deriveStageTransitions(
  context: BusinessArchitectureContext,
  stages: BusinessArchitectureStageIntent[],
): BusinessArchitectureTransition[] {
  const nodeToStage = new Map<string, string>();
  stages.forEach((stage) =>
    stage.nodeIds.forEach((nodeId) => nodeToStage.set(nodeId, stage.id)),
  );
  const groups = new Map<string, BusinessArchitectureTransition>();
  context.controlEdges.forEach((edge) => {
    const sourceStageId = nodeToStage.get(edge.sourceId);
    const targetStageId = nodeToStage.get(edge.targetId);
    if (!sourceStageId || !targetStageId || sourceStageId === targetStageId) {
      return;
    }
    const kind = edge.kind as BusinessTransitionKind;
    const key = `${sourceStageId}\u0000${targetStageId}\u0000${kind}`;
    const current = groups.get(key);
    groups.set(key, {
      id: `transition_${groups.size + 1}`,
      sourceStageId,
      targetStageId,
      kind,
      order: Math.min(current?.order ?? Number.MAX_SAFE_INTEGER, edge.order),
      edgeCount: (current?.edgeCount ?? 0) + 1,
    });
  });
  return [...groups.values()].sort(
    (left, right) =>
      left.order - right.order ||
      left.sourceStageId.localeCompare(right.sourceStageId) ||
      left.targetStageId.localeCompare(right.targetStageId),
  );
}

function summarizePipelineSection(
  node: NodeType | undefined,
  section: "recognition" | "action",
): string | undefined {
  if (!node || !isSemanticLayoutNode(node)) return undefined;
  const value = node.data[section] as
    | { type?: unknown; param?: Record<string, unknown> }
    | undefined;
  if (!value || typeof value !== "object") return undefined;
  const type = typeof value.type === "string" ? value.type : undefined;
  const cues = CUE_FIELDS.flatMap((field) => {
    const cue = formatCue(value.param?.[field]);
    return cue ? [`${field}=${cue}`] : [];
  });
  return [type, ...cues].filter(Boolean).join("; ").slice(0, 240) || undefined;
}

function readBusinessHint(node: NodeType | undefined): string | undefined {
  const attach = node?.data.others?.attach;
  if (!attach || typeof attach !== "object" || Array.isArray(attach)) {
    return undefined;
  }
  for (const field of BUSINESS_HINT_FIELDS) {
    const value = (attach as Record<string, unknown>)[field];
    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 240);
    }
  }
  return undefined;
}

function formatCue(value: unknown): string | undefined {
  if (typeof value === "string") return JSON.stringify(value.slice(0, 80));
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, 3).map(formatCue).filter(Boolean);
    return items.length > 0 ? `[${items.join(", ")}]` : undefined;
  }
  return undefined;
}

function createUniqueStageId(existingIds: Set<string>, base: string): string {
  let id = base;
  let index = 2;
  while (existingIds.has(id)) {
    id = `${base}_${index}`;
    index += 1;
  }
  return id;
}
