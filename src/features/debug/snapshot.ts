import { flowToPipeline } from "../../core/parser";
import type { EdgeType, NodeType, PipelineNodeType } from "../../stores/flow";
import { useFileStore } from "../../stores/fileStore";
import { useFlowStore } from "../../stores/flow";
import {
  useLocalFileStore,
  type LocalFileInfo,
} from "../../stores/localFileStore";
import {
  NodeTypeEnum,
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "../../components/flow/nodes";
import type {
  DebugEdgeReason,
  DebugGraphSnapshot,
  DebugNodeResolverSnapshot,
  DebugNodeTarget,
} from "./types";

interface DebugFileSource {
  fileId: string;
  path?: string;
  relativePath?: string;
  prefix?: string;
  nodes: NodeType[];
  edges: EdgeType[];
  pipeline: Record<string, unknown>;
  config?: Record<string, unknown>;
  dirty?: boolean;
}

export interface DebugSnapshotBundle {
  graphSnapshot: DebugGraphSnapshot;
  resolverSnapshot: DebugNodeResolverSnapshot;
}

type ResolverNode = DebugNodeResolverSnapshot["nodes"][number];
type ResolverEdge = DebugNodeResolverSnapshot["edges"][number];

export function getRuntimeName(label: string, prefix?: string): string {
  const normalizedPrefix = prefix?.trim();
  return normalizedPrefix ? `${normalizedPrefix}_${label}` : label;
}

function getNodeRuntimeName(node: NodeType, prefix?: string): string {
  return getRuntimeName(node.data.label, prefix);
}

function getEdgeReason(edge: EdgeType): Exclude<DebugEdgeReason, "candidate"> {
  if (
    edge.targetHandle === TargetHandleTypeEnum.JumpBack ||
    edge.attributes?.jump_back
  ) {
    return "jump_back";
  }
  if (edge.attributes?.anchor) return "anchor";
  if (edge.sourceHandle === SourceHandleTypeEnum.Error) return "on_error";
  return "next";
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function buildFileSources(): DebugFileSource[] {
  const fileState = useFileStore.getState();
  const flowState = useFlowStore.getState();

  const openedFiles = fileState.files.some(
    (file) => file.fileName === fileState.currentFile.fileName,
  )
    ? fileState.files
    : [...fileState.files, fileState.currentFile];

  return openedFiles.map((file) => {
    const isCurrent = file.fileName === fileState.currentFile.fileName;
    const sourceFile = isCurrent ? fileState.currentFile : file;
    const config = sourceFile.config;
    const nodes = isCurrent ? flowState.nodes : file.nodes;
    const edges = isCurrent ? flowState.edges : file.edges;
    const pipeline = flowToPipeline({
      nodes,
      edges,
      fileName: sourceFile.fileName,
      config,
    });

    return {
      fileId: sourceFile.fileName,
      path: config.filePath,
      relativePath: config.relativePath,
      prefix: config.prefix,
      nodes,
      edges,
      pipeline,
      config: toRecord(config),
      dirty: !config.filePath || config.isModifiedExternally,
    };
  });
}

function localResolverNodeId(filePath: string, runtimeName: string): string {
  return `local-json:${filePath}#${runtimeName}`;
}

function displayNameFromRuntimeName(runtimeName: string, prefix?: string): string {
  const normalizedPrefix = prefix?.trim();
  if (normalizedPrefix && runtimeName.startsWith(`${normalizedPrefix}_`)) {
    return runtimeName.slice(normalizedPrefix.length + 1);
  }
  return runtimeName;
}

export function buildDebugSnapshotBundle(
  localFiles: LocalFileInfo[] | undefined = useLocalFileStore.getState().files,
  resourcePaths: string[] = [],
): DebugSnapshotBundle {
  const generatedAt = new Date().toISOString();
  const fileState = useFileStore.getState();
  const fileSources = buildFileSources();
  const rootFileId = fileState.currentFile.fileName;

  const resolverNodes = fileSources.flatMap((file) =>
    file.nodes
      .filter((node): node is PipelineNodeType => node.type === NodeTypeEnum.Pipeline)
      .map((node) => ({
        fileId: file.fileId,
        nodeId: node.id,
        runtimeName: getNodeRuntimeName(node, file.prefix),
        displayName: node.data.label,
        prefix: file.prefix || undefined,
        sourcePath: file.path,
      })),
  );
  const loadedSourcePaths = new Set(
    fileSources
      .map((file) => file.path)
      .filter((path): path is string => Boolean(path)),
  );
  const localResolverNodes = localFiles
    .filter((file) => !loadedSourcePaths.has(file.file_path))
    .flatMap((file) =>
      (file.nodes ?? [])
        .map((node) => {
          const runtimeName = node.label?.trim();
          if (!runtimeName) return undefined;
          const prefix = node.prefix || file.prefix || undefined;
          return {
            fileId: file.file_path,
            nodeId: localResolverNodeId(file.file_path, runtimeName),
            runtimeName,
            displayName: displayNameFromRuntimeName(runtimeName, prefix),
            prefix,
            sourcePath: file.file_path,
          };
        })
        .filter((node): node is NonNullable<typeof node> => Boolean(node)),
    );

  const resolverEdges = fileSources.flatMap((file) =>
    file.edges
      .map((edge) => {
        const sourceNode = file.nodes.find((node) => node.id === edge.source);
        const targetNode = file.nodes.find((node) => node.id === edge.target);
        if (!sourceNode || !targetNode) return undefined;
        if (
          sourceNode.type !== NodeTypeEnum.Pipeline ||
          targetNode.type !== NodeTypeEnum.Pipeline
        ) {
          return undefined;
        }
        return {
          edgeId: edge.id,
          fromRuntimeName: getNodeRuntimeName(sourceNode, file.prefix),
          toRuntimeName: getNodeRuntimeName(targetNode, file.prefix),
          reason: getEdgeReason(edge),
          sourcePath: file.path,
        };
      })
      .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge)),
  );

  const graphSnapshot: DebugGraphSnapshot = {
    generatedAt,
    rootFileId,
    files: fileSources.map((file) => ({
      fileId: file.fileId,
      path: file.path,
      relativePath: file.relativePath,
      pipeline: file.pipeline,
      config: file.config,
      dirty: file.dirty,
    })),
  };

  const resolverSnapshot: DebugNodeResolverSnapshot = {
    generatedAt,
    rootFileId,
    nodes: selectEffectiveResolverNodes(
      [...resolverNodes, ...localResolverNodes],
      resourcePaths,
    ),
    edges: selectEffectiveResolverEdges(resolverEdges, resourcePaths),
  };

  return {
    graphSnapshot,
    resolverSnapshot,
  };
}

export function selectEffectiveResolverNodes(
  nodes: ResolverNode[],
  resourcePaths: string[] = [],
): ResolverNode[] {
  const effective = new Map<string, { node: ResolverNode; order: number }>();

  nodes.forEach((node, order) => {
    const runtimeName = node.runtimeName.trim();
    if (!runtimeName) return;
    const key = runtimeName.toLowerCase();
    const current = effective.get(key);
    if (
      !current ||
      shouldPreferResolverSource(
        current.node.sourcePath,
        node.sourcePath,
        resourcePaths,
        current.order,
        order,
      )
    ) {
      effective.set(key, { node, order });
    }
  });

  return [...effective.values()]
    .sort((left, right) => left.order - right.order)
    .map((entry) => entry.node);
}

export function selectEffectiveResolverEdges(
  edges: ResolverEdge[],
  resourcePaths: string[] = [],
): ResolverEdge[] {
  const effective = new Map<string, { edge: ResolverEdge; order: number }>();

  edges.forEach((edge, order) => {
    const key = [
      edge.fromRuntimeName.trim().toLowerCase(),
      edge.toRuntimeName.trim().toLowerCase(),
      edge.reason,
    ].join("\x00");
    const current = effective.get(key);
    if (
      !current ||
      shouldPreferResolverSource(
        current.edge.sourcePath,
        edge.sourcePath,
        resourcePaths,
        current.order,
        order,
      )
    ) {
      effective.set(key, { edge, order });
    }
  });

  return [...effective.values()]
    .sort((left, right) => left.order - right.order)
    .map((entry) => entry.edge);
}

function shouldPreferResolverSource(
  currentSourcePath: string | undefined,
  nextSourcePath: string | undefined,
  resourcePaths: string[],
  currentOrder: number,
  nextOrder: number,
): boolean {
  const currentPriority = resolveResolverSourcePriority(
    currentSourcePath,
    resourcePaths,
  );
  const nextPriority = resolveResolverSourcePriority(nextSourcePath, resourcePaths);
  if (currentPriority !== nextPriority) {
    return nextPriority > currentPriority;
  }
  return nextOrder > currentOrder;
}

function resolveResolverSourcePriority(
  sourcePath: string | undefined,
  resourcePaths: string[],
): number {
  const normalizedSourcePath = normalizeResolverPath(sourcePath);
  if (!normalizedSourcePath) {
    return -1;
  }

  let matchedIndex = -1;
  let matchedLength = -1;
  resourcePaths.forEach((resourcePath, index) => {
    const normalizedResourcePath = normalizeResolverPath(resourcePath);
    if (!normalizedResourcePath) {
      return;
    }
    const isExactMatch = normalizedSourcePath === normalizedResourcePath;
    const isChildMatch = normalizedSourcePath.startsWith(
      `${normalizedResourcePath}/`,
    );
    if (!isExactMatch && !isChildMatch) {
      return;
    }
    if (normalizedResourcePath.length > matchedLength) {
      matchedIndex = index;
      matchedLength = normalizedResourcePath.length;
    }
  });
  return matchedIndex;
}

function normalizeResolverPath(path?: string): string {
  return path?.trim().replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase() ?? "";
}

export function resolveDebugNodeTarget(
  nodeId: string,
  snapshot: DebugNodeResolverSnapshot,
): DebugNodeTarget | undefined {
  const node = snapshot.nodes.find((item) => item.nodeId === nodeId);
  if (!node) return undefined;
  return {
    fileId: node.fileId,
    nodeId: node.nodeId,
    runtimeName: node.runtimeName,
    sourcePath: node.sourcePath,
  };
}
