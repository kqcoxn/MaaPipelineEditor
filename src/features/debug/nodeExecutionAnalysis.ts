import type {
  DebugEvent,
  DebugTraceReplayStatus,
} from "./types";
import type {
  DebugNodeExecutionAttempt,
} from "./nodeExecutionAttempts";
import type {
  DebugNodeExecutionRecord,
  ResolverNode,
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
  selectedExecutionAttemptId?: string;
  selectedExecutionAttemptNodeId?: string;
  selectedExecutionAttemptEdgeIds: string[];
  executionPathNodeIds: string[];
  executionPathEdgeIds: string[];
  executionCandidateEdgeIds: string[];
  highlightedFailureNodeIds: string[];
}

export interface SelectDebugNodeExecutionOverlayOptions {
  records: DebugNodeExecutionRecord[];
  selectedRecord?: DebugNodeExecutionRecord;
  selectedAttempt?: DebugNodeExecutionAttempt;
  resolverEdges?: ResolverEdge[];
  resolverNodes?: ResolverNode[];
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

  for (const record of records) {
    if (record.runId !== selectedRecord.runId) continue;
    if (record.firstSeq > selectedRecord.lastSeq) continue;

    if (record.nodeId) {
      executionPathNodeIds.add(record.nodeId);
      if (record.status === "failed" || record.hasFailure) {
        highlightedFailureNodeIds.add(record.nodeId);
      }
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
    selectedExecutionAttemptEdgeIds: [],
    executionPathNodeIds: [...executionPathNodeIds],
    executionPathEdgeIds: [...executionPathEdgeIds],
    executionCandidateEdgeIds: [...executionCandidateEdgeIds],
    highlightedFailureNodeIds: [...highlightedFailureNodeIds],
  };
}

export function selectDebugNodeExecutionOverlayFromEdges(
  records: DebugNodeExecutionRecord[],
  selectedRecord: DebugNodeExecutionRecord | undefined,
  edges: ResolverEdge[],
  selectedAttempt?: DebugNodeExecutionAttempt,
  resolverNodes: ResolverNode[] = [],
): DebugNodeExecutionOverlay {
  return selectDebugNodeExecutionOverlayForSelection({
    records,
    selectedRecord,
    selectedAttempt,
    resolverEdges: edges,
    resolverNodes,
  });
}

export function selectDebugNodeExecutionOverlayForSelection({
  records,
  selectedRecord,
  selectedAttempt,
  resolverEdges = [],
  resolverNodes = [],
}: SelectDebugNodeExecutionOverlayOptions): DebugNodeExecutionOverlay {
  const overlay = selectDebugNodeExecutionOverlay(records, selectedRecord);
  if (!selectedRecord) return overlay;

  const pathEdges = new Set(overlay.executionPathEdgeIds);
  const candidateEdges = new Set(overlay.executionCandidateEdgeIds);
  const attemptEdges = new Set<string>();
  const edgeIndex = createRuntimeEdgeIndex(resolverEdges);
  const nodeByRuntime = createRuntimeNodeIndex(resolverNodes);
  const selectedAttemptNodeId = selectedAttempt
    ? resolveAttemptTargetNodeId(selectedAttempt, nodeByRuntime)
    : undefined;

  for (const record of records) {
    if (record.runId !== selectedRecord.runId) continue;
    if (record.firstSeq > selectedRecord.lastSeq) continue;
    collectNextListCandidateEdges(record, edgeIndex, candidateEdges);
  }

  if (
    selectedAttempt?.kind === "recognition" &&
    !selectedRecord.syntheticKind &&
    selectedRecord.nodeId
  ) {
    const edge = resolveAttemptCandidateEdge(
      selectedRecord,
      selectedAttempt,
      edgeIndex,
    );
    if (edge?.edgeId) {
      attemptEdges.add(edge.edgeId);
      candidateEdges.add(edge.edgeId);
    }
  }

  return {
    ...overlay,
    selectedExecutionAttemptId: selectedAttempt?.id,
    selectedExecutionAttemptNodeId: selectedAttemptNodeId,
    selectedExecutionAttemptEdgeIds: [...attemptEdges],
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

function createRuntimeNodeIndex(nodes: ResolverNode[]): Map<string, ResolverNode> {
  return new Map(nodes.map((node) => [node.runtimeName, node]));
}

function resolveAttemptTargetNodeId(
  attempt: DebugNodeExecutionAttempt,
  nodeByRuntime: Map<string, ResolverNode>,
): string | undefined {
  if (!attempt.targetRuntimeName) return undefined;
  return nodeByRuntime.get(attempt.targetRuntimeName)?.nodeId;
}

function resolveAttemptCandidateEdge(
  record: DebugNodeExecutionRecord,
  attempt: DebugNodeExecutionAttempt,
  edgeIndex: EdgeIndex,
): ResolverEdge | undefined {
  const sourceRuntimeName =
    record.attributionMode === "node"
      ? attempt.sourceNextOwnerRuntimeName
      : attempt.sourceNextOwnerRuntimeName ?? record.runtimeName;
  const targetRuntimeName = attempt.targetRuntimeName;
  if (!sourceRuntimeName || !targetRuntimeName) return undefined;
  if (sourceRuntimeName === targetRuntimeName) return undefined;
  return edgeIndex.get(runtimeEdgeKey(sourceRuntimeName, targetRuntimeName));
}

function collectNextListCandidateEdges(
  record: DebugNodeExecutionRecord,
  edgeIndex: EdgeIndex,
  candidateEdges: Set<string>,
): void {
  if (record.syntheticKind || !record.nodeId) return;
  for (const event of record.nextListEvents) {
    for (const item of readNextItems(event)) {
      const edge = edgeIndex.get(runtimeEdgeKey(record.runtimeName, item.name));
      if (edge) candidateEdges.add(edge.edgeId);
    }
  }
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

function emptyExecutionOverlay(): DebugNodeExecutionOverlay {
  return {
    selectedExecutionAttemptEdgeIds: [],
    executionPathNodeIds: [],
    executionPathEdgeIds: [],
    executionCandidateEdgeIds: [],
    highlightedFailureNodeIds: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ""))];
}
