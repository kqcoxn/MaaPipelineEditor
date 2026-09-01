import { flowToPipeline } from "../../../core/parser";
import type { EdgeType, NodeType, PipelineNodeType } from "../../../stores/flow";
import { useFileStore } from "@/stores/project/fileStore";
import { useFlowStore } from "../../../stores/flow";
import {
  useLocalFileStore,
  type LocalFileInfo,
} from "@/stores/project/localFileStore";
import {
  NodeTypeEnum,
  SourceHandleTypeEnum,
  TargetHandleTypeEnum,
} from "../../../components/flow/nodes";
import type {
  DebugEdgeReason,
  DebugGraphSnapshot,
  DebugNodeResolverSnapshot,
  DebugNodeTarget,
} from "../types";

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

  return openedFiles
    .filter(
      (file) =>
        file.fileName === fileState.currentFile.fileName ||
        !file.config.isDeleted,
    )
    .map((file) => {
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
  const grouped = new Map<string, Array<{ node: ResolverNode; order: number }>>();
  nodes.forEach((node, order) => {
    const runtimeName = node.runtimeName.trim();
    if (!runtimeName) return;
    const entries = grouped.get(runtimeName) ?? [];
    entries.push({ node, order });
    grouped.set(runtimeName, entries);
  });

  return [...grouped.values()]
    .flatMap((entries) => selectWinningBundleEntries(entries, resourcePaths))
    .sort((left, right) => left.order - right.order)
    .map((entry) => entry.node);
}

export function selectEffectiveResolverEdges(
  edges: ResolverEdge[],
  resourcePaths: string[] = [],
): ResolverEdge[] {
  const grouped = new Map<string, Array<{ edge: ResolverEdge; order: number }>>();

  edges.forEach((edge, order) => {
    const key = [
      edge.fromRuntimeName.trim(),
      edge.toRuntimeName.trim(),
      edge.reason,
    ].join("\x00");
    const entries = grouped.get(key) ?? [];
    entries.push({ edge, order });
    grouped.set(key, entries);
  });

  return [...grouped.values()]
    .flatMap((entries) => selectWinningBundleEntries(entries, resourcePaths))
    .sort((left, right) => left.order - right.order)
    .map((entry) => entry.edge);
}

function selectWinningBundleEntries<T extends { sourcePath?: string }>(
  entries: Array<{ node: T; order: number }> | Array<{ edge: T; order: number }>,
  resourcePaths: string[],
): typeof entries {
  let winningPriority = -1;
  for (const entry of entries) {
    const value = "node" in entry ? entry.node : entry.edge;
    winningPriority = Math.max(
      winningPriority,
      resolveResolverSourcePriority(value.sourcePath, resourcePaths),
    );
  }
  return entries.filter((entry) => {
    const value = "node" in entry ? entry.node : entry.edge;
    return resolveResolverSourcePriority(value.sourcePath, resourcePaths) === winningPriority;
  }) as typeof entries;
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

export function toDebugNodeTarget(node: ResolverNode): DebugNodeTarget {
  return {
    fileId: node.fileId,
    nodeId: node.nodeId,
    runtimeName: node.runtimeName,
    sourcePath: node.sourcePath,
  };
}

export function getDebugNodeTargetKey(
  target: Pick<
    DebugNodeTarget,
    "fileId" | "nodeId" | "runtimeName" | "sourcePath"
  >,
): string {
  return JSON.stringify([
    target.fileId,
    target.nodeId,
    target.runtimeName,
    target.sourcePath ?? "",
  ]);
}

export function resolveCurrentDebugNodeTarget(
  nodeId: string,
  snapshot: DebugNodeResolverSnapshot,
): DebugNodeTarget | undefined {
  const node = snapshot.nodes.find(
    (item) =>
      item.fileId === snapshot.rootFileId && item.nodeId === nodeId,
  );
  if (!node) return undefined;
  return toDebugNodeTarget(node);
}

export function resolveDebugNodeTarget(
  target: DebugNodeTarget,
  snapshot: DebugNodeResolverSnapshot,
): DebugNodeTarget | undefined {
  const node = snapshot.nodes.find(
    (item) =>
      item.fileId === target.fileId &&
      item.nodeId === target.nodeId &&
      item.runtimeName === target.runtimeName,
  );
  return node ? toDebugNodeTarget(node) : undefined;
}
