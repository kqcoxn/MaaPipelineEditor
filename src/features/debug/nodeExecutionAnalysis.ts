import type { DebugArtifactEntry } from "../../stores/debugArtifactStore";
import type {
  DebugBatchRecognitionResult,
  DebugEvent,
  DebugTraceReplayStatus,
} from "./types";
import type {
  DebugNodeExecutionRecord,
  ResolverEdge,
} from "./nodeExecutionSelector";

export type DebugNodeReplayRecordState =
  | "live"
  | "not-reached"
  | "current"
  | "passed";

export interface DebugNodeReplayControl {
  active: boolean;
  cursorSeq?: number;
  runId?: string;
  nodeId?: string;
  targetRecordId?: string;
  recordState: DebugNodeReplayRecordState;
}

export interface DebugNodeExecutionOverlay {
  selectedExecutionRecordId?: string;
  selectedExecutionNodeId?: string;
  executionPathNodeIds: string[];
  executionPathEdgeIds: string[];
  executionCandidateEdgeIds: string[];
  highlightedFailureNodeIds: string[];
  highlightedSlowNodeIds: string[];
}

export interface DebugBatchRecognitionNodeSummary {
  id: string;
  sessionId: string;
  batchId: string;
  nodeId: string;
  fileId: string;
  runtimeName: string;
  status: string;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  stopped?: boolean;
  averageDurationMs?: number;
  detailRefs: string[];
  screenshotRefs: string[];
  results: DebugBatchRecognitionResult["results"];
}

export interface DebugRunComparisonSide {
  runId: string;
  records: DebugNodeExecutionRecord[];
  status?: DebugNodeExecutionRecord["status"];
  occurrenceCount: number;
  durationMs?: number;
  hasFailure: boolean;
  artifactCount: number;
  firstSeq?: number;
  lastSeq?: number;
}

export interface DebugNodeExecutionRunComparison {
  id: string;
  nodeId?: string;
  runtimeName: string;
  label?: string;
  fileId?: string;
  sourcePath?: string;
  left: DebugRunComparisonSide;
  right: DebugRunComparisonSide;
  hasDifference: boolean;
  differenceReasons: string[];
}

type EdgeIndex = Map<string, ResolverEdge>;

export function getDebugNodeReplayControl(
  record: DebugNodeExecutionRecord | undefined,
  replayStatus: DebugTraceReplayStatus | undefined,
): DebugNodeReplayControl {
  if (!record || !replayStatus?.active) {
    return {
      active: false,
      recordState: "live",
    };
  }

  return {
    active: true,
    cursorSeq: replayStatus.cursorSeq,
    runId: replayStatus.runId,
    nodeId: replayStatus.nodeId,
    targetRecordId: record.id,
    recordState: getDebugReplayRecordState(record, replayStatus),
  };
}

export function getDebugReplayRecordState(
  record: DebugNodeExecutionRecord,
  replayStatus: DebugTraceReplayStatus | undefined,
): DebugNodeReplayRecordState {
  if (!replayStatus?.active) return "live";
  if (replayStatus.runId && record.runId !== replayStatus.runId) {
    return "not-reached";
  }
  if (replayStatus.nodeId && record.nodeId !== replayStatus.nodeId) {
    return "not-reached";
  }
  const cursorSeq = replayStatus.cursorSeq;
  if (cursorSeq >= record.firstSeq && cursorSeq <= record.lastSeq) {
    return "current";
  }
  return cursorSeq > record.lastSeq ? "passed" : "not-reached";
}

export function selectDebugNodeExecutionOverlay(
  records: DebugNodeExecutionRecord[],
  selectedRecord: DebugNodeExecutionRecord | undefined,
): DebugNodeExecutionOverlay {
  if (!selectedRecord) {
    return emptyExecutionOverlay();
  }

  const executionPathNodeIds = new Set<string>();
  const executionPathEdgeIds = new Set<string>();
  const executionCandidateEdgeIds = new Set<string>();
  const highlightedFailureNodeIds = new Set<string>();
  const highlightedSlowNodeIds = new Set<string>();

  for (const record of records) {
    if (record.runId !== selectedRecord.runId) continue;
    if (record.firstSeq > selectedRecord.lastSeq) continue;

    if (record.nodeId) {
      executionPathNodeIds.add(record.nodeId);
      if (record.hasFailure) highlightedFailureNodeIds.add(record.nodeId);
      if (record.slow) highlightedSlowNodeIds.add(record.nodeId);
    }

    for (const event of record.events) {
      if (!event.edge?.edgeId) continue;
      if (event.edge.reason === "candidate") {
        executionCandidateEdgeIds.add(event.edge.edgeId);
      } else {
        executionPathEdgeIds.add(event.edge.edgeId);
      }
    }
  }

  return {
    selectedExecutionRecordId: selectedRecord.id,
    selectedExecutionNodeId: selectedRecord.nodeId,
    executionPathNodeIds: [...executionPathNodeIds],
    executionPathEdgeIds: [...executionPathEdgeIds],
    executionCandidateEdgeIds: [...executionCandidateEdgeIds],
    highlightedFailureNodeIds: [...highlightedFailureNodeIds],
    highlightedSlowNodeIds: [...highlightedSlowNodeIds],
  };
}

export function selectDebugNodeExecutionOverlayFromEdges(
  records: DebugNodeExecutionRecord[],
  selectedRecord: DebugNodeExecutionRecord | undefined,
  edges: ResolverEdge[],
): DebugNodeExecutionOverlay {
  const overlay = selectDebugNodeExecutionOverlay(records, selectedRecord);
  if (!selectedRecord) return overlay;

  const pathEdges = new Set(overlay.executionPathEdgeIds);
  const candidateEdges = new Set(overlay.executionCandidateEdgeIds);
  const edgeIndex = createRuntimeEdgeIndex(edges);

  for (const record of records) {
    if (record.runId !== selectedRecord.runId) continue;
    if (record.firstSeq > selectedRecord.lastSeq) continue;
    collectNextListCandidateEdges(record, edgeIndex, candidateEdges);
  }

  return {
    ...overlay,
    executionPathEdgeIds: [...pathEdges],
    executionCandidateEdgeIds: [...candidateEdges],
  };
}

function createRuntimeEdgeIndex(edges: ResolverEdge[]): EdgeIndex {
  return new Map(
    edges.map((edge) => [
      runtimeEdgeKey(edge.fromRuntimeName, edge.toRuntimeName),
      edge,
    ]),
  );
}

function collectNextListCandidateEdges(
  record: DebugNodeExecutionRecord,
  edgeIndex: EdgeIndex,
  candidateEdges: Set<string>,
): void {
  for (const event of record.nextListEvents) {
    for (const item of readNextItems(event)) {
      const edge = edgeIndex.get(runtimeEdgeKey(record.runtimeName, item.name));
      if (edge) candidateEdges.add(edge.edgeId);
    }
  }
}

export function selectDebugBatchRecognitionNodeSummaries(
  artifacts: Record<string, DebugArtifactEntry>,
): DebugBatchRecognitionNodeSummary[] {
  return Object.values(artifacts)
    .map((entry) => entry.payload?.data)
    .filter(isBatchRecognitionResult)
    .map((result) => {
      const detailRefs = uniqueStrings(
        result.results.flatMap((item) => item.detailRefs ?? []),
      );
      const screenshotRefs = uniqueStrings(
        result.results.flatMap((item) => item.screenshotRefs ?? []),
      );
      return {
        id: result.batchId,
        sessionId: result.sessionId,
        batchId: result.batchId,
        nodeId: result.target.nodeId,
        fileId: result.target.fileId,
        runtimeName: result.target.runtimeName,
        status: result.status,
        total: result.total,
        completed: result.completed,
        succeeded: result.succeeded,
        failed: result.failed,
        stopped: result.stopped,
        averageDurationMs: result.averageDurationMs,
        detailRefs,
        screenshotRefs,
        results: result.results,
      };
    })
    .sort((a, b) => a.batchId.localeCompare(b.batchId));
}

export function batchSummariesForRecord(
  summaries: DebugBatchRecognitionNodeSummary[],
  record: DebugNodeExecutionRecord,
): DebugBatchRecognitionNodeSummary[] {
  return summaries.filter((summary) => {
    if (summary.batchId === record.runId) return true;
    if (record.nodeId && summary.nodeId === record.nodeId) return true;
    return summary.runtimeName === record.runtimeName;
  });
}

export function compareDebugNodeExecutionRuns(
  records: DebugNodeExecutionRecord[],
  runIds: [string, string],
): DebugNodeExecutionRunComparison[] {
  const [leftRunId, rightRunId] = runIds;
  const groups = new Map<
    string,
    {
      nodeId?: string;
      runtimeName: string;
      label?: string;
      fileId?: string;
      sourcePath?: string;
      left: DebugNodeExecutionRecord[];
      right: DebugNodeExecutionRecord[];
    }
  >();

  for (const record of records) {
    if (record.runId !== leftRunId && record.runId !== rightRunId) continue;
    const key = record.nodeId ?? `runtime:${record.runtimeName}`;
    const current =
      groups.get(key) ??
      {
        nodeId: record.nodeId,
        runtimeName: record.runtimeName,
        label: record.label,
        fileId: record.fileId,
        sourcePath: record.sourcePath,
        left: [],
        right: [],
      };
    if (record.runId === leftRunId) {
      current.left.push(record);
    } else {
      current.right.push(record);
    }
    groups.set(key, current);
  }

  return [...groups.entries()]
    .map(([id, group]) => {
      const left = toComparisonSide(leftRunId, group.left);
      const right = toComparisonSide(rightRunId, group.right);
      const differenceReasons = comparisonDifferenceReasons(left, right);
      return {
        id,
        nodeId: group.nodeId,
        runtimeName: group.runtimeName,
        label: group.label,
        fileId: group.fileId,
        sourcePath: group.sourcePath,
        left,
        right,
        hasDifference: differenceReasons.length > 0,
        differenceReasons,
      };
    })
    .sort(compareRunComparisons);
}

export function resolveEdgeIdsFromEvents(events: DebugEvent[]): {
  executedEdgeIds: string[];
  candidateEdgeIds: string[];
} {
  const executedEdgeIds = new Set<string>();
  const candidateEdgeIds = new Set<string>();
  for (const event of events) {
    if (!event.edge?.edgeId) continue;
    if (event.edge.reason === "candidate") {
      candidateEdgeIds.add(event.edge.edgeId);
    } else {
      executedEdgeIds.add(event.edge.edgeId);
    }
  }
  return {
    executedEdgeIds: [...executedEdgeIds],
    candidateEdgeIds: [...candidateEdgeIds],
  };
}

export function edgeIdsFromResolverEdges(edges: ResolverEdge[]): string[] {
  return uniqueStrings(edges.map((edge) => edge.edgeId));
}

function toComparisonSide(
  runId: string,
  records: DebugNodeExecutionRecord[],
): DebugRunComparisonSide {
  const sorted = [...records].sort((a, b) => a.firstSeq - b.firstSeq);
  const durationMs = sorted.reduce((total, record) => {
    if (record.durationMs === undefined) return total;
    return total + record.durationMs;
  }, 0);
  return {
    runId,
    records: sorted,
    status: resolveComparisonStatus(sorted),
    occurrenceCount: sorted.length,
    durationMs: sorted.some((record) => record.durationMs !== undefined)
      ? durationMs
      : undefined,
    hasFailure: sorted.some((record) => record.hasFailure),
    artifactCount: sorted.reduce(
      (total, record) =>
        total + record.detailRefs.length + record.screenshotRefs.length,
      0,
    ),
    firstSeq: sorted[0]?.firstSeq,
    lastSeq: sorted[sorted.length - 1]?.lastSeq,
  };
}

function resolveComparisonStatus(
  records: DebugNodeExecutionRecord[],
): DebugNodeExecutionRecord["status"] | undefined {
  if (records.length === 0) return undefined;
  if (records.some((record) => record.status === "failed")) return "failed";
  if (records.some((record) => record.status === "running")) return "running";
  if (records.every((record) => record.status === "succeeded")) {
    return "succeeded";
  }
  return "visited";
}

function comparisonDifferenceReasons(
  left: DebugRunComparisonSide,
  right: DebugRunComparisonSide,
): string[] {
  const reasons: string[] = [];
  if (left.occurrenceCount !== right.occurrenceCount) {
    reasons.push("执行次数不同");
  }
  if (left.status !== right.status) {
    reasons.push("状态不同");
  }
  if (left.hasFailure !== right.hasFailure) {
    reasons.push("失败不同");
  }
  if (left.artifactCount !== right.artifactCount) {
    reasons.push("Artifact 不同");
  }
  if (durationDelta(left.durationMs, right.durationMs) > 0) {
    reasons.push("耗时不同");
  }
  return reasons;
}

function durationDelta(left?: number, right?: number): number {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined || right === undefined) return Number.POSITIVE_INFINITY;
  return Math.abs(left - right);
}

function readNextItems(event: DebugEvent): Array<{ name: string }> {
  const next = event.data?.next;
  if (!Array.isArray(next)) return [];
  return next
    .filter(isRecord)
    .map((item) => ({
      name: typeof item.name === "string" ? item.name : String(item.name ?? ""),
    }))
    .filter((item) => item.name.trim() !== "");
}

function runtimeEdgeKey(fromRuntimeName: string, toRuntimeName: string): string {
  return `${fromRuntimeName}\x00${toRuntimeName}`;
}

function compareRunComparisons(
  a: DebugNodeExecutionRunComparison,
  b: DebugNodeExecutionRunComparison,
): number {
  const differenceDelta = Number(b.hasDifference) - Number(a.hasDifference);
  if (differenceDelta) return differenceDelta;
  const firstSeqA = Math.min(
    a.left.firstSeq ?? Number.POSITIVE_INFINITY,
    a.right.firstSeq ?? Number.POSITIVE_INFINITY,
  );
  const firstSeqB = Math.min(
    b.left.firstSeq ?? Number.POSITIVE_INFINITY,
    b.right.firstSeq ?? Number.POSITIVE_INFINITY,
  );
  if (firstSeqA !== firstSeqB) return firstSeqA - firstSeqB;
  return (a.label ?? a.runtimeName).localeCompare(b.label ?? b.runtimeName);
}

function emptyExecutionOverlay(): DebugNodeExecutionOverlay {
  return {
    executionPathNodeIds: [],
    executionPathEdgeIds: [],
    executionCandidateEdgeIds: [],
    highlightedFailureNodeIds: [],
    highlightedSlowNodeIds: [],
  };
}

function isBatchRecognitionResult(
  value: unknown,
): value is DebugBatchRecognitionResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "batchId" in value &&
    "target" in value &&
    "results" in value
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ""))];
}
