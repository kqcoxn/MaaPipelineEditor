import type { EdgeType, NodeType } from "./flow";

export type PipelineExternalChange = "modified" | "deleted";

export interface PipelineSaveState {
  dirty: boolean;
  savedFingerprint: string;
  externalChange?: PipelineExternalChange;
  saving: boolean;
}

export interface PipelineFingerprintConfig {
  prefix: string;
  coordinateMode?: string;
  savedViewport?: { x: number; y: number; zoom: number };
  nodeOrderMap?: Record<string, number>;
  nextOrderNumber?: number;
}

export interface PipelineFingerprintSource {
  fileName: string;
  nodes: NodeType[];
  edges: EdgeType[];
  config: PipelineFingerprintConfig;
}

export function createPipelineFingerprint(
  source: PipelineFingerprintSource,
): string {
  return stableStringify({
    nodes: source.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      data: node.data,
      position: node.position,
      parentId: node.parentId,
      extent: node.extent,
    })),
    edges: source.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      sourceHandle: edge.sourceHandle,
      target: edge.target,
      targetHandle: edge.targetHandle,
      label: edge.label,
      attributes: edge.attributes,
    })),
    config: {
      prefix: source.config.prefix,
      coordinateMode: source.config.coordinateMode,
      savedViewport: source.config.savedViewport,
      nodeOrderMap: source.config.nodeOrderMap,
      nextOrderNumber: source.config.nextOrderNumber,
    },
  });
}

export function createCleanPipelineSaveState(
  source: PipelineFingerprintSource,
): PipelineSaveState {
  return {
    dirty: false,
    savedFingerprint: createPipelineFingerprint(source),
    saving: false,
  };
}

function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}
