import type { DebugNodeReplay, DebugTraceSummary } from "./traceReducer";
import type {
  DebugEventKind,
  DebugEvent,
  DebugNodeExecutionFilters,
  DebugNodeExecutionStatus,
  DebugNodeResolverSnapshot,
  DebugPerformanceNodeSummary,
  DebugPerformanceSummary,
  DebugRunMode,
} from "./types";

type ResolverNode = DebugNodeResolverSnapshot["nodes"][number];
export type ResolverEdge = DebugNodeResolverSnapshot["edges"][number];
export type DebugNodeExecutionDurationSource = "trace" | "performance";

export interface DebugNodeExecutionSelectorOptions {
  performanceSummary?: DebugPerformanceSummary;
}

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
  durationMs?: number;
  durationSource?: DebugNodeExecutionDurationSource;
  slow: boolean;
  hasFailure: boolean;
  hasArtifact: boolean;
  eventKinds: DebugEventKind[];
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

export interface DebugNodeExecutionRecordGroup {
  id: string;
  runId: string;
  nodeId?: string;
  runtimeName: string;
  label?: string;
  fileId?: string;
  sourcePath?: string;
  records: DebugNodeExecutionRecord[];
  firstSeq: number;
  lastSeq: number;
  occurrenceCount: number;
  eventCount: number;
  slow: boolean;
  hasFailure: boolean;
  hasArtifact: boolean;
}

export function selectDebugNodeExecutionRecords(
  summary: DebugTraceSummary,
  resolverNodes: ResolverNode[],
  filters: DebugNodeExecutionFilters,
  options: DebugNodeExecutionSelectorOptions = {},
): DebugNodeExecutionRecord[] {
  const nodeById = new Map(resolverNodes.map((node) => [node.nodeId, node]));
  const nodeByRuntime = new Map(
    resolverNodes.map((node) => [node.runtimeName, node]),
  );
  const performanceIndex = createPerformanceIndex(
    options.performanceSummary?.nodes,
  );
  const slowIndex = createPerformanceIndex(options.performanceSummary?.slowNodes);

  return Object.values(summary.nodeReplays)
    .flat()
    .map((replay) =>
      toRecord(summary, replay, nodeById, nodeByRuntime, {
        performanceSummary: options.performanceSummary,
        performanceIndex,
        slowIndex,
      }),
    )
    .filter((record) => matchesFilters(record, filters))
    .sort((a, b) => compareRecords(a, b, filters.sortMode ?? "execution"));
}

export function groupDebugNodeExecutionRecords(
  records: DebugNodeExecutionRecord[],
): DebugNodeExecutionRecordGroup[] {
  const groups = new Map<string, DebugNodeExecutionRecordGroup>();

  for (const record of records) {
    const key = `${record.runId}:${record.nodeId ?? record.runtimeName}`;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, {
        id: key,
        runId: record.runId,
        nodeId: record.nodeId,
        runtimeName: record.runtimeName,
        label: record.label,
        fileId: record.fileId,
        sourcePath: record.sourcePath,
        records: [record],
        firstSeq: record.firstSeq,
        lastSeq: record.lastSeq,
        occurrenceCount: 1,
        eventCount: record.eventCount,
        slow: record.slow,
        hasFailure: record.hasFailure,
        hasArtifact: record.hasArtifact,
      });
      continue;
    }

    current.records.push(record);
    current.records.sort(compareExecutionOrder);
    current.firstSeq = Math.min(current.firstSeq, record.firstSeq);
    current.lastSeq = Math.max(current.lastSeq, record.lastSeq);
    current.occurrenceCount = current.records.length;
    current.eventCount += record.eventCount;
    current.slow = current.slow || record.slow;
    current.hasFailure = current.hasFailure || record.hasFailure;
    current.hasArtifact = current.hasArtifact || record.hasArtifact;
  }

  return [...groups.values()];
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
  context: {
    performanceSummary?: DebugPerformanceSummary;
    performanceIndex: Map<string, DebugPerformanceNodeSummary[]>;
    slowIndex: Map<string, DebugPerformanceNodeSummary[]>;
  },
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
  const performanceNode = findPerformanceNode(context, replay);
  const traceDurationMs = durationMillis(
    events[0]?.timestamp,
    events[events.length - 1]?.timestamp,
  );
  const durationMs =
    performanceNode?.durationMs !== undefined
      ? performanceNode.durationMs
      : traceDurationMs;
  const eventKinds = uniqueEventKinds(events);
  const hasFailure =
    replay.status === "failed" ||
    events.some(
      (event) => event.phase === "failed" || event.status === "failed",
    );
  const hasArtifact = detailRefs.length > 0 || screenshotRefs.length > 0;

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
    durationMs,
    durationSource: performanceNode ? "performance" : "trace",
    slow: Boolean(findSlowNode(context, replay)),
    hasFailure,
    hasArtifact,
    eventKinds,
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
  if (filters.runId && record.runId !== filters.runId) {
    return false;
  }
  if (filters.status !== "all" && record.status !== filters.status) {
    return false;
  }
  if (
    filters.eventKind &&
    filters.eventKind !== "all" &&
    !record.eventKinds.includes(filters.eventKind)
  ) {
    return false;
  }
  if (filters.artifact === "with-artifact" && !record.hasArtifact) {
    return false;
  }
  if (filters.artifact === "without-artifact" && record.hasArtifact) {
    return false;
  }
  if (filters.failedOnly && !record.hasFailure) {
    return false;
  }
  if (!filters.nodeId) return true;
  return record.nodeId === filters.nodeId || record.runtimeName === filters.nodeId;
}

function uniqueRefs(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function uniqueEventKinds(events: DebugEvent[]): DebugEventKind[] {
  return [...new Set(events.map((event) => event.kind))];
}

function compareRecords(
  a: DebugNodeExecutionRecord,
  b: DebugNodeExecutionRecord,
  sortMode: DebugNodeExecutionFilters["sortMode"],
): number {
  switch (sortMode) {
    case "failure-first": {
      const failureDelta = Number(b.hasFailure) - Number(a.hasFailure);
      return failureDelta || compareExecutionOrder(a, b);
    }
    case "slow-first": {
      const slowDelta = Number(b.slow) - Number(a.slow);
      const durationDelta = (b.durationMs ?? -1) - (a.durationMs ?? -1);
      return slowDelta || durationDelta || compareExecutionOrder(a, b);
    }
    case "latest":
      if (a.lastSeq === b.lastSeq) return b.firstSeq - a.firstSeq;
      return b.lastSeq - a.lastSeq;
    case "execution":
    default:
      return compareExecutionOrder(a, b);
  }
}

function compareExecutionOrder(
  a: Pick<DebugNodeExecutionRecord, "firstSeq" | "lastSeq">,
  b: Pick<DebugNodeExecutionRecord, "firstSeq" | "lastSeq">,
): number {
  if (a.firstSeq === b.firstSeq) return a.lastSeq - b.lastSeq;
  return a.firstSeq - b.firstSeq;
}

function createPerformanceIndex(
  nodes: DebugPerformanceNodeSummary[] | undefined,
): Map<string, DebugPerformanceNodeSummary[]> {
  const index = new Map<string, DebugPerformanceNodeSummary[]>();
  for (const node of nodes ?? []) {
    const keys = performanceNodeKeys(node.nodeId, node.runtimeName);
    for (const key of keys) {
      index.set(key, [...(index.get(key) ?? []), node]);
    }
  }
  return index;
}

function findPerformanceNode(
  context: {
    performanceSummary?: DebugPerformanceSummary;
    performanceIndex: Map<string, DebugPerformanceNodeSummary[]>;
  },
  replay: DebugNodeReplay,
): DebugPerformanceNodeSummary | undefined {
  if (context.performanceSummary?.runId !== replay.runId) return undefined;
  return findMatchingPerformanceNode(context.performanceIndex, replay);
}

function findSlowNode(
  context: {
    performanceSummary?: DebugPerformanceSummary;
    slowIndex: Map<string, DebugPerformanceNodeSummary[]>;
  },
  replay: DebugNodeReplay,
): DebugPerformanceNodeSummary | undefined {
  if (context.performanceSummary?.runId !== replay.runId) return undefined;
  return findMatchingPerformanceNode(context.slowIndex, replay);
}

function findMatchingPerformanceNode(
  index: Map<string, DebugPerformanceNodeSummary[]>,
  replay: DebugNodeReplay,
): DebugPerformanceNodeSummary | undefined {
  const keys = performanceNodeKeys(replay.nodeId, replay.runtimeName);
  for (const key of keys) {
    const node = index
      .get(key)
      ?.find(
        (item) =>
          item.firstSeq === replay.firstSeq && item.lastSeq === replay.lastSeq,
      );
    if (node) return node;
  }
  return undefined;
}

function performanceNodeKeys(nodeId: string | undefined, runtimeName: string) {
  return [
    nodeId ? `node:${nodeId}` : undefined,
    runtimeName ? `runtime:${runtimeName}` : undefined,
  ].filter((key): key is string => Boolean(key));
}

function durationMillis(
  start: string | undefined,
  end: string | undefined,
): number | undefined {
  if (!start || !end) return undefined;
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    return undefined;
  }
  return Math.max(0, endTime - startTime);
}

function debugResolverEdgeKey(fromRuntimeName: string, toRuntimeName: string) {
  return `${fromRuntimeName}\x00${toRuntimeName}`;
}
