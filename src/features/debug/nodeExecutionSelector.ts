import type { DebugNodeReplay, DebugTraceSummary } from "./traceReducer";
import type {
  DebugEvent,
  DebugNodeExecutionFilters,
  DebugNodeExecutionStatus,
  DebugNodeResolverSnapshot,
  DebugRunMode,
} from "./types";

type ResolverNode = DebugNodeResolverSnapshot["nodes"][number];
export type ResolverEdge = DebugNodeResolverSnapshot["edges"][number];

export interface DebugNodeExecutionRecord {
  id: string;
  sessionId?: string;
  runId: string;
  runMode?: DebugRunMode;
  nodeId?: string;
  fileId?: string;
  runtimeName: string;
  label?: string;
  sourcePath?: string;
  status: DebugNodeExecutionStatus;
  occurrence: number;
  firstSeq: number;
  lastSeq: number;
  firstTimestamp?: string;
  lastTimestamp?: string;
  eventCount: number;
  recognitionCount: number;
  actionCount: number;
  nextListCount: number;
  waitFreezesCount: number;
  diagnosticCount: number;
  detailRefs: string[];
  screenshotRefs: string[];
  events: DebugEvent[];
  recognitionEvents: DebugEvent[];
  actionEvents: DebugEvent[];
  nextListEvents: DebugEvent[];
  waitFreezesEvents: DebugEvent[];
  unmapped?: boolean;
}

export function selectDebugNodeExecutionRecords(
  summary: DebugTraceSummary,
  resolverNodes: ResolverNode[],
  filters: DebugNodeExecutionFilters,
): DebugNodeExecutionRecord[] {
  const nodeById = new Map(resolverNodes.map((node) => [node.nodeId, node]));
  const nodeByRuntime = new Map(
    resolverNodes.map((node) => [node.runtimeName, node]),
  );

  return Object.values(summary.nodeReplays)
    .flat()
    .map((replay) => toRecord(summary, replay, nodeById, nodeByRuntime))
    .filter((record) => matchesFilters(record, filters))
    .sort((a, b) => {
      if (a.firstSeq === b.firstSeq) return a.lastSeq - b.lastSeq;
      return a.firstSeq - b.firstSeq;
    });
}

export function createDebugResolverEdgeIndex(
  edges: ResolverEdge[],
): Map<string, ResolverEdge> {
  return new Map(
    edges.map((edge) => [
      debugResolverEdgeKey(edge.fromRuntimeName, edge.toRuntimeName),
      edge,
    ]),
  );
}

export function findDebugResolverEdge(
  edgeIndex: Map<string, ResolverEdge>,
  fromRuntimeName: string,
  toRuntimeName: string,
): ResolverEdge | undefined {
  return edgeIndex.get(debugResolverEdgeKey(fromRuntimeName, toRuntimeName));
}

function toRecord(
  summary: DebugTraceSummary,
  replay: DebugNodeReplay,
  nodeById: Map<string, ResolverNode>,
  nodeByRuntime: Map<string, ResolverNode>,
): DebugNodeExecutionRecord {
  const resolverNode =
    (replay.nodeId ? nodeById.get(replay.nodeId) : undefined) ??
    nodeByRuntime.get(replay.runtimeName);
  const events = [...replay.events].sort((a, b) => a.seq - b.seq);
  const detailRefs = uniqueRefs([
    ...replay.detailRefs,
    ...events.map((event) => event.detailRef),
  ]);
  const screenshotRefs = uniqueRefs([
    ...replay.screenshotRefs,
    ...events.map((event) => event.screenshotRef),
  ]);

  return {
    id: `${replay.runId}:${replay.nodeId ?? replay.runtimeName}:${replay.firstSeq}:${replay.lastSeq}`,
    sessionId: summary.sessionId,
    runId: replay.runId,
    runMode: replay.runMode ?? summary.runMode,
    nodeId: replay.nodeId,
    fileId: replay.fileId ?? resolverNode?.fileId,
    runtimeName: replay.runtimeName,
    label: resolverNode?.displayName ?? replay.label,
    sourcePath: resolverNode?.sourcePath,
    status: replay.status,
    occurrence: replay.occurrence,
    firstSeq: replay.firstSeq,
    lastSeq: replay.lastSeq,
    firstTimestamp: events[0]?.timestamp,
    lastTimestamp: events[events.length - 1]?.timestamp,
    eventCount: events.length,
    recognitionCount: replay.recognitionEvents.length,
    actionCount: replay.actionEvents.length,
    nextListCount: replay.nextListEvents.length,
    waitFreezesCount: replay.waitFreezesEvents.length,
    diagnosticCount: events.filter((event) => event.kind === "diagnostic")
      .length,
    detailRefs,
    screenshotRefs,
    events,
    recognitionEvents: replay.recognitionEvents,
    actionEvents: replay.actionEvents,
    nextListEvents: replay.nextListEvents,
    waitFreezesEvents: replay.waitFreezesEvents,
    unmapped: replay.unmapped || !replay.nodeId,
  };
}

function matchesFilters(
  record: DebugNodeExecutionRecord,
  filters: DebugNodeExecutionFilters,
): boolean {
  if (filters.status !== "all" && record.status !== filters.status) {
    return false;
  }
  if (!filters.nodeId) return true;
  return record.nodeId === filters.nodeId || record.runtimeName === filters.nodeId;
}

function uniqueRefs(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function debugResolverEdgeKey(fromRuntimeName: string, toRuntimeName: string) {
  return `${fromRuntimeName}\x00${toRuntimeName}`;
}
