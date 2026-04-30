import type { DebugNodeReplay, DebugTraceSummary } from "./traceReducer";
import {
  selectNodeAttributionRecordSeeds,
  type DebugNodeExecutionRecordSeed,
} from "./nodeExecutionAttribution";
import {
  buildDebugNodeExecutionAttempts,
  isFailedDebugNodeExecutionAttempt,
  isSuccessfulDebugNodeExecutionAttempt,
  type DebugNodeExecutionAttempt,
} from "./nodeExecutionAttempts";
import { normalizeTaskerBootstrapSeeds } from "./nodeExecutionTaskerBootstrap";
import type {
  DebugExecutionAttributionMode,
  DebugEventKind,
  DebugEvent,
  DebugNodeExecutionFilters,
  DebugNodeExecutionStatus,
  DebugNodeResolverSnapshot,
  DebugPerformanceNodeSummary,
  DebugPerformanceSummary,
  DebugRunMode,
  DebugSyntheticNodeKind,
} from "./types";
import {
  formatDebugNodeDisplayName,
  isDebugTaskerBootstrapNode,
} from "./syntheticNode";

export type ResolverNode = DebugNodeResolverSnapshot["nodes"][number];
export type ResolverEdge = DebugNodeResolverSnapshot["edges"][number];
export type DebugNodeExecutionDurationSource = "trace" | "performance";

export interface DebugNodeExecutionSelectorOptions {
  attributionMode?: DebugExecutionAttributionMode;
  resolverEdges?: ResolverEdge[];
  performanceSummary?: DebugPerformanceSummary;
}

export interface DebugNodeExecutionNextCandidate {
  runtimeName: string;
  label?: string;
  hit?: boolean;
  jumpBack?: boolean;
  anchor?: boolean;
  edgeId?: string;
  unmappedEdge: boolean;
  recognitionSeqs: number[];
  detailRefs: string[];
  screenshotRefs: string[];
}

export interface DebugNodeExecutionNextSummary {
  candidateCount: number;
  hitCount: number;
  missCount: number;
  edgeCount: number;
  jumpBackCount: number;
  anchorCount: number;
  candidates: DebugNodeExecutionNextCandidate[];
}

export interface DebugNodeExecutionRecord {
  id: string;
  attributionMode: DebugExecutionAttributionMode;
  sessionId?: string;
  runId: string;
  runMode?: DebugRunMode;
  nodeId?: string;
  fileId?: string;
  runtimeName: string;
  label?: string;
  sourcePath?: string;
  syntheticKind?: DebugSyntheticNodeKind;
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
  recognitionAttempts: DebugNodeExecutionAttempt[];
  actionAttempts: DebugNodeExecutionAttempt[];
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
  recognitionTargetRuntimeNames: string[];
  sourceNextOwnerRuntimeName?: string;
  sourceNextOwnerLabel?: string;
  sourceNextOwnerRuntimeNames: string[];
  nextCandidateSummary: DebugNodeExecutionNextSummary;
}

export interface DebugNodeExecutionRecordGroup {
  id: string;
  runId: string;
  nodeId?: string;
  runtimeName: string;
  label?: string;
  fileId?: string;
  sourcePath?: string;
  syntheticKind?: DebugSyntheticNodeKind;
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
  const attributionMode = options.attributionMode ?? "next";
  const edgeIndex = createDebugResolverEdgeIndex(options.resolverEdges ?? []);
  const context = {
    attributionMode,
    edgeIndex,
    performanceSummary: options.performanceSummary,
    performanceIndex,
    slowIndex,
  };

  const seeds =
    attributionMode === "node"
      ? selectNodeAttributionRecordSeeds(summary, nodeById, nodeByRuntime)
      : Object.values(summary.nodeReplays)
          .flat()
          .map((replay) => seedFromReplay(summary, replay));

  const records = normalizeTaskerBootstrapSeeds(seeds).map((seed) =>
    toRecordFromSeed(summary, seed, nodeById, nodeByRuntime, context),
  );

  return records
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
        syntheticKind: record.syntheticKind,
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

function seedFromReplay(
  summary: DebugTraceSummary,
  replay: DebugNodeReplay,
): DebugNodeExecutionRecordSeed {
  return {
    nodeId: replay.nodeId,
    runtimeName: replay.runtimeName,
    fileId: replay.fileId,
    label: replay.label,
    syntheticKind: replay.syntheticKind,
    runId: replay.runId,
    runMode: replay.runMode ?? summary.runMode,
    status: replay.status,
    occurrence: replay.occurrence,
    events: replay.events,
    unmapped: replay.unmapped,
  };
}

function toRecordFromSeed(
  summary: DebugTraceSummary,
  seed: DebugNodeExecutionRecordSeed,
  nodeById: Map<string, ResolverNode>,
  nodeByRuntime: Map<string, ResolverNode>,
  context: {
    attributionMode: DebugExecutionAttributionMode;
    edgeIndex: Map<string, ResolverEdge>;
    performanceSummary?: DebugPerformanceSummary;
    performanceIndex: Map<string, DebugPerformanceNodeSummary[]>;
    slowIndex: Map<string, DebugPerformanceNodeSummary[]>;
  },
): DebugNodeExecutionRecord {
  const resolverNode =
    (seed.nodeId ? nodeById.get(seed.nodeId) : undefined) ??
    nodeByRuntime.get(seed.runtimeName);
  const syntheticKind = seed.syntheticKind;
  const syntheticNode = isDebugTaskerBootstrapNode({
    runtimeName: seed.runtimeName,
    syntheticKind,
  });
  const events = [...seed.events].sort((a, b) => a.seq - b.seq);
  const detailRefs = uniqueRefs([
    ...events.map((event) => event.detailRef),
  ]);
  const screenshotRefs = uniqueRefs([
    ...events.map((event) => event.screenshotRef),
  ]);
  const firstSeq = events[0]?.seq ?? 0;
  const lastSeq = events[events.length - 1]?.seq ?? firstSeq;
  const performanceNode = findPerformanceNode(context, {
    nodeId: seed.nodeId,
    runtimeName: seed.runtimeName,
    runId: seed.runId,
    firstSeq,
    lastSeq,
  });
  const traceDurationMs = durationMillis(
    events[0]?.timestamp,
    events[events.length - 1]?.timestamp,
  );
  const durationMs =
    performanceNode?.durationMs !== undefined
      ? performanceNode.durationMs
      : traceDurationMs;
  const eventKinds = uniqueEventKinds(events);
  const hasArtifact = detailRefs.length > 0 || screenshotRefs.length > 0;
  const sourceNextOwnerRuntimeNames = uniqueStrings(
    events
      .filter((event) => event.kind === "recognition")
      .map((event) => dataString(event.data, "parentNode"))
      .filter(
        (runtimeName): runtimeName is string =>
          Boolean(runtimeName) && runtimeName !== seed.runtimeName,
      ),
  );
  const sourceNextOwnerRuntimeName =
    sourceNextOwnerRuntimeNames.length === 1
      ? sourceNextOwnerRuntimeNames[0]
      : undefined;
  const sourceNextOwnerLabel = sourceNextOwnerRuntimeName
    ? formatOwnerRuntimeName(sourceNextOwnerRuntimeName, nodeByRuntime)
    : sourceNextOwnerRuntimeNames.length > 1
      ? "多个 NextList"
      : undefined;
  const recognitionEvents = events.filter(
    (event) => event.kind === "recognition",
  );
  const actionEvents = events.filter((event) => event.kind === "action");
  const nextListEvents = events.filter((event) => event.kind === "next-list");
  const waitFreezesEvents = events.filter(
    (event) => event.kind === "wait-freezes",
  );
  const recordId = `${context.attributionMode}:${seed.runId}:${seed.nodeId ?? seed.runtimeName}:${firstSeq}:${lastSeq}`;
  const recognitionAttempts = buildDebugNodeExecutionAttempts({
    attributionMode: context.attributionMode,
    events: recognitionEvents,
    kind: "recognition",
    recordId,
    recordRuntimeName: seed.runtimeName,
    resolveSourceNextOwnerLabel: (runtimeName) =>
      formatOwnerRuntimeName(runtimeName, nodeByRuntime),
    sourceNextOwnerLabel,
  });
  const actionAttempts = buildDebugNodeExecutionAttempts({
    attributionMode: context.attributionMode,
    events: actionEvents,
    kind: "action",
    recordId,
    recordRuntimeName: seed.runtimeName,
    resolveSourceNextOwnerLabel: (runtimeName) =>
      formatOwnerRuntimeName(runtimeName, nodeByRuntime),
    sourceNextOwnerLabel,
  });
  const outcome = resolveRecordOutcome(
    seed.status,
    events,
    recognitionAttempts,
    actionAttempts,
  );

  return {
    id: recordId,
    attributionMode: context.attributionMode,
    sessionId: summary.sessionId,
    runId: seed.runId,
    runMode: seed.runMode ?? summary.runMode,
    nodeId: seed.nodeId,
    fileId: syntheticNode ? undefined : seed.fileId ?? resolverNode?.fileId,
    runtimeName: seed.runtimeName,
    label: formatDebugNodeDisplayName(
      {
        runtimeName: seed.runtimeName,
        label: resolverNode?.displayName ?? seed.label,
        syntheticKind,
      },
      seed.runtimeName,
    ),
    sourcePath: syntheticNode ? undefined : resolverNode?.sourcePath,
    syntheticKind,
    status: outcome.status,
    occurrence: seed.occurrence,
    firstSeq,
    lastSeq,
    firstTimestamp: events[0]?.timestamp,
    lastTimestamp: events[events.length - 1]?.timestamp,
    durationMs,
    durationSource: performanceNode ? "performance" : "trace",
    slow: Boolean(
      findSlowNode(context, {
        nodeId: seed.nodeId,
        runtimeName: seed.runtimeName,
        runId: seed.runId,
        firstSeq,
        lastSeq,
      }),
    ),
    hasFailure: outcome.hasFailure,
    hasArtifact,
    eventKinds,
    eventCount: events.length,
    recognitionCount: recognitionEvents.length,
    actionCount: actionEvents.length,
    recognitionAttempts,
    actionAttempts,
    nextListCount: nextListEvents.length,
    waitFreezesCount: waitFreezesEvents.length,
    diagnosticCount: events.filter((event) => event.kind === "diagnostic")
      .length,
    detailRefs,
    screenshotRefs,
    events,
    recognitionEvents,
    actionEvents,
    nextListEvents,
    waitFreezesEvents,
    unmapped: syntheticNode ? false : seed.unmapped || !seed.nodeId,
    recognitionTargetRuntimeNames: uniqueStrings(
      recognitionEvents
        .map((event) => event.node?.runtimeName)
        .filter((runtimeName): runtimeName is string => Boolean(runtimeName)),
    ),
    sourceNextOwnerRuntimeName,
    sourceNextOwnerLabel,
    sourceNextOwnerRuntimeNames,
    nextCandidateSummary: summarizeNextCandidates({
      edgeIndex: context.edgeIndex,
      nodeByRuntime,
      recordRuntimeName: seed.runtimeName,
      syntheticNode,
      nextListEvents,
      recognitionEvents,
    }),
  };
}

function resolveRecordOutcome(
  seedStatus: DebugNodeExecutionStatus | undefined,
  events: DebugEvent[],
  recognitionAttempts: DebugNodeExecutionAttempt[],
  actionAttempts: DebugNodeExecutionAttempt[],
): { status: DebugNodeExecutionStatus; hasFailure: boolean } {
  const attempts = [...recognitionAttempts, ...actionAttempts];
  const hasSuccess = attempts.some(isSuccessfulDebugNodeExecutionAttempt);
  const hasAttemptFailure = attempts.some(isFailedDebugNodeExecutionAttempt);

  if (hasSuccess) {
    return {
      status: "succeeded",
      hasFailure: hasAttemptFailure,
    };
  }
  if (hasAttemptFailure) {
    return {
      status: "failed",
      hasFailure: false,
    };
  }
  if (
    seedStatus === "failed" ||
    events.some(
      (event) => event.phase === "failed" || event.status === "failed",
    )
  ) {
    return {
      status: "failed",
      hasFailure: false,
    };
  }
  return {
    status: seedStatus ?? "visited",
    hasFailure: false,
  };
}

function summarizeNextCandidates({
  edgeIndex,
  nodeByRuntime,
  recordRuntimeName,
  syntheticNode,
  nextListEvents,
  recognitionEvents,
}: {
  edgeIndex: Map<string, ResolverEdge>;
  nodeByRuntime: Map<string, ResolverNode>;
  recordRuntimeName: string;
  syntheticNode: boolean;
  nextListEvents: DebugEvent[];
  recognitionEvents: DebugEvent[];
}): DebugNodeExecutionNextSummary {
  const candidates = new Map<string, DebugNodeExecutionNextCandidate>();
  for (const event of nextListEvents) {
    for (const item of readNextItems(event)) {
      const current = candidates.get(item.name) ?? {
        runtimeName: item.name,
        label: formatOwnerRuntimeName(item.name, nodeByRuntime),
        jumpBack: false,
        anchor: false,
        unmappedEdge: false,
        recognitionSeqs: [],
        detailRefs: [],
        screenshotRefs: [],
      };
      current.jumpBack = current.jumpBack || item.jumpBack;
      current.anchor = current.anchor || item.anchor;
      const edge = syntheticNode
        ? undefined
        : edgeIndex.get(debugResolverEdgeKey(recordRuntimeName, item.name));
      current.edgeId = current.edgeId ?? edge?.edgeId;
      current.unmappedEdge = !syntheticNode && !current.edgeId;
      candidates.set(item.name, current);
    }
  }

  for (const event of recognitionEvents) {
    const targetRuntimeName = event.node?.runtimeName;
    if (!targetRuntimeName || !candidates.has(targetRuntimeName)) continue;
    const candidate = candidates.get(targetRuntimeName);
    if (!candidate) continue;
    candidate.recognitionSeqs.push(event.seq);
    if (event.detailRef && !candidate.detailRefs.includes(event.detailRef)) {
      candidate.detailRefs.push(event.detailRef);
    }
    if (
      event.screenshotRef &&
      !candidate.screenshotRefs.includes(event.screenshotRef)
    ) {
      candidate.screenshotRefs.push(event.screenshotRef);
    }
    const hit = readRecognitionHit(event);
    if (hit !== undefined) candidate.hit = hit;
  }

  const items = [...candidates.values()];
  return {
    candidateCount: items.length,
    hitCount: items.filter((item) => item.hit === true).length,
    missCount: items.filter((item) => item.hit === false).length,
    edgeCount: items.filter((item) => item.edgeId).length,
    jumpBackCount: items.filter((item) => item.jumpBack).length,
    anchorCount: items.filter((item) => item.anchor).length,
    candidates: items,
  };
}

function readNextItems(event: DebugEvent): Array<{
  name: string;
  jumpBack: boolean;
  anchor: boolean;
}> {
  const next = event.data?.next;
  if (!Array.isArray(next)) return [];
  return next
    .filter(isRecord)
    .map((item) => ({
      name: typeof item.name === "string" ? item.name : String(item.name ?? ""),
      jumpBack: item.jumpBack === true,
      anchor: item.anchor === true,
    }))
    .filter((item) => item.name.trim() !== "");
}

function readRecognitionHit(event: DebugEvent): boolean | undefined {
  const hit = dataBoolean(event.data, "hit");
  if (hit !== undefined) return hit;
  if (event.phase === "failed" || event.status === "failed") return false;
  return undefined;
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
  replay: Pick<
    DebugNodeReplay,
    "nodeId" | "runtimeName" | "runId" | "firstSeq" | "lastSeq"
  >,
): DebugPerformanceNodeSummary | undefined {
  if (context.performanceSummary?.runId !== replay.runId) return undefined;
  return findMatchingPerformanceNode(context.performanceIndex, replay);
}

function findSlowNode(
  context: {
    performanceSummary?: DebugPerformanceSummary;
    slowIndex: Map<string, DebugPerformanceNodeSummary[]>;
  },
  replay: Pick<
    DebugNodeReplay,
    "nodeId" | "runtimeName" | "runId" | "firstSeq" | "lastSeq"
  >,
): DebugPerformanceNodeSummary | undefined {
  if (context.performanceSummary?.runId !== replay.runId) return undefined;
  return findMatchingPerformanceNode(context.slowIndex, replay);
}

function findMatchingPerformanceNode(
  index: Map<string, DebugPerformanceNodeSummary[]>,
  replay: Pick<DebugNodeReplay, "nodeId" | "runtimeName" | "firstSeq" | "lastSeq">,
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

function formatOwnerRuntimeName(
  runtimeName: string,
  nodeByRuntime: Map<string, ResolverNode>,
): string {
  const resolverNode = nodeByRuntime.get(runtimeName);
  return formatDebugNodeDisplayName(
    {
      runtimeName,
      label: resolverNode?.displayName,
    },
    runtimeName,
  ) ?? runtimeName;
}

function dataString(
  data: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = data?.[key];
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

function dataBoolean(
  data: Record<string, unknown> | undefined,
  key: string,
): boolean | undefined {
  const value = data?.[key];
  return typeof value === "boolean" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ""))];
}
