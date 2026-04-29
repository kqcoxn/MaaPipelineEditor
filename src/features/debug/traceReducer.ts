import type {
  DebugArtifactRef,
  DebugDiagnostic,
  DebugEvent,
  DebugEventKind,
  DebugNodeExecutionStatus,
  DebugRunMode,
  DebugSessionStatus,
  DebugSyntheticNodeKind,
} from "./types";
import {
  isDebugTaskerBootstrapNode,
  taskerBootstrapSyntheticKindForRuntime,
} from "./syntheticNode";

export interface DebugNodeRunState {
  nodeId: string;
  runtimeName: string;
  label?: string;
  fileId?: string;
  syntheticKind?: DebugSyntheticNodeKind;
  status: DebugNodeExecutionStatus;
  lastSeq: number;
}

export interface DebugTraceSummary {
  sessionId?: string;
  runId?: string;
  runMode?: DebugRunMode;
  status: DebugSessionStatus;
  currentNodeId?: string;
  currentRuntimeName?: string;
  visitedNodeIds: string[];
  succeededNodeIds: string[];
  failedNodeIds: string[];
  executedEdgeIds: string[];
  candidateEdgeIds: string[];
  recognitionEvents: DebugEvent[];
  actionEvents: DebugEvent[];
  diagnostics: DebugDiagnostic[];
  artifacts: DebugArtifactRef[];
  lastEvent?: DebugEvent;
  nodeStates: Record<string, DebugNodeRunState>;
  nodeReplays: Record<string, DebugNodeReplay[]>;
}

export interface DebugTraceReplayCursor {
  active: boolean;
  cursorSeq: number;
  runId?: string;
  nodeId?: string;
}

export interface DebugNodeReplay {
  nodeId?: string;
  runtimeName: string;
  fileId?: string;
  label?: string;
  syntheticKind?: DebugSyntheticNodeKind;
  runId: string;
  runMode?: DebugRunMode;
  status: DebugNodeRunState["status"];
  occurrence: number;
  firstSeq: number;
  lastSeq: number;
  events: DebugEvent[];
  recognitionEvents: DebugEvent[];
  actionEvents: DebugEvent[];
  nextListEvents: DebugEvent[];
  waitFreezesEvents: DebugEvent[];
  detailRefs: string[];
  screenshotRefs: string[];
  unmapped?: boolean;
}

export interface DebugTraceStateSnapshot {
  events: DebugEvent[];
}

function defaultSummary(): DebugTraceSummary {
  return {
    status: "idle",
    visitedNodeIds: [],
    succeededNodeIds: [],
    failedNodeIds: [],
    executedEdgeIds: [],
    candidateEdgeIds: [],
    recognitionEvents: [],
    actionEvents: [],
    diagnostics: [],
    artifacts: [],
    nodeStates: {},
    nodeReplays: {},
  };
}

function addUnique(target: Set<string>, value?: string): void {
  if (value) target.add(value);
}

function resolveStatusFromSessionEvent(event: DebugEvent): DebugSessionStatus {
  const status = event.status as DebugSessionStatus | undefined;
  if (status) return status;

  switch (event.phase) {
    case "starting":
      return "running";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    default:
      return "idle";
  }
}

function resolveNodeStatus(
  kind: DebugEventKind,
  phase: DebugEvent["phase"],
): DebugNodeRunState["status"] {
  if (phase === "failed") return "failed";
  if (phase === "succeeded" || phase === "completed") return "succeeded";
  if (phase === "starting") return "running";
  if (kind === "node") return "running";
  return "visited";
}

function diagnosticFromEvent(event: DebugEvent): DebugDiagnostic | undefined {
  if (event.kind !== "diagnostic") return undefined;
  const data = event.data;
  if (!data) return undefined;

  return {
    severity:
      data.severity === "error" ||
      data.severity === "warning" ||
      data.severity === "info"
        ? data.severity
        : "info",
    code: typeof data.code === "string" ? data.code : "debug_event",
    message:
      typeof data.message === "string"
        ? data.message
        : event.maafwMessage ?? "调试诊断事件",
    fileId: typeof data.fileId === "string" ? data.fileId : event.node?.fileId,
    nodeId: typeof data.nodeId === "string" ? data.nodeId : event.node?.nodeId,
    fieldPath: typeof data.fieldPath === "string" ? data.fieldPath : undefined,
    sourcePath:
      typeof data.sourcePath === "string" ? data.sourcePath : undefined,
    data,
  };
}

function artifactFromEvent(
  event: DebugEvent,
  refId: string | undefined,
  type: string,
): DebugArtifactRef | undefined {
  if (!refId) return undefined;
  return {
    id: refId,
    sessionId: event.sessionId,
    type,
    mime: type.includes("image") ? "image/png" : "application/json",
    createdAt: event.timestamp,
    eventSeq: event.seq,
  };
}

interface NodeReplayIdentity {
  identityKey: string;
  bucketKey: string;
  runtimeKey: string;
  nodeId?: string;
  runtimeName: string;
  fileId?: string;
  label?: string;
  syntheticKind?: DebugSyntheticNodeKind;
  unmapped?: boolean;
}

export function reduceDebugTrace(
  snapshot: DebugTraceStateSnapshot,
): DebugTraceSummary {
  if (snapshot.events.length === 0) return defaultSummary();

  const visitedNodeIds = new Set<string>();
  const succeededNodeIds = new Set<string>();
  const failedNodeIds = new Set<string>();
  const executedEdgeIds = new Set<string>();
  const candidateEdgeIds = new Set<string>();
  const recognitionEvents: DebugEvent[] = [];
  const actionEvents: DebugEvent[] = [];
  const diagnostics: DebugDiagnostic[] = [];
  const artifactsById = new Map<string, DebugArtifactRef>();
  const nodeStates: Record<string, DebugNodeRunState> = {};
  const nodeReplayBuckets = new Map<string, DebugNodeReplay[]>();
  const activeNodeReplays = new Map<string, DebugNodeReplay>();
  const activeRuntimeReplays = new Map<string, DebugNodeReplay>();
  const occurrenceByIdentity = new Map<string, number>();

  let sessionId: string | undefined;
  let runId: string | undefined;
  let runMode: DebugRunMode | undefined;
  let status: DebugSessionStatus = "idle";
  let currentNodeId: string | undefined;
  let currentRuntimeName: string | undefined;
  let lastEvent: DebugEvent | undefined;

  for (const event of snapshot.events) {
    sessionId = event.sessionId;
    runId = event.runId;
    lastEvent = event;

    if (event.kind === "session") {
      status = resolveStatusFromSessionEvent(event);
      if (typeof event.data?.mode === "string") {
        runMode = event.data.mode as DebugRunMode;
      }
    }

    const nodeStatus = resolveNodeStatus(event.kind, event.phase);
    const replay = ensureNodeReplayForEvent({
      activeNodeReplays,
      activeRuntimeReplays,
      event,
      nodeReplayBuckets,
      occurrenceByIdentity,
      runMode,
      status: nodeStatus,
    });
    if (replay) {
      applyEventToNodeReplay(replay, event, nodeStatus);
      currentRuntimeName = replay.runtimeName;

      if (replay.nodeId) {
        addUnique(visitedNodeIds, replay.nodeId);
        currentNodeId = replay.nodeId;
        nodeStates[replay.nodeId] = {
          nodeId: replay.nodeId,
          runtimeName: replay.runtimeName,
          label: replay.label,
          fileId: replay.fileId,
          status: replay.status,
          lastSeq: event.seq,
        };

        if (replay.status === "succeeded") {
          addUnique(succeededNodeIds, replay.nodeId);
        }
        if (replay.status === "failed") {
          addUnique(failedNodeIds, replay.nodeId);
        }
      }
    }

    if (event.edge?.edgeId) {
      if (event.edge.reason === "candidate") {
        addUnique(candidateEdgeIds, event.edge.edgeId);
      } else {
        addUnique(executedEdgeIds, event.edge.edgeId);
      }
    }

    if (event.kind === "recognition") recognitionEvents.push(event);
    if (event.kind === "action") actionEvents.push(event);

    const diagnostic = diagnosticFromEvent(event);
    if (diagnostic) diagnostics.push(diagnostic);

    const detailArtifact = artifactFromEvent(
      event,
      event.detailRef,
      `${event.kind}/detail`,
    );
    if (detailArtifact) artifactsById.set(detailArtifact.id, detailArtifact);

    const screenshotArtifact = artifactFromEvent(
      event,
      event.screenshotRef,
      `${event.kind}/screenshot`,
    );
    if (screenshotArtifact) {
      artifactsById.set(screenshotArtifact.id, screenshotArtifact);
    }
  }

  if (status === "idle" && lastEvent) {
    status = lastEvent.phase === "failed" ? "failed" : "running";
  }

  return {
    sessionId,
    runId,
    runMode,
    status,
    currentNodeId,
    currentRuntimeName,
    visitedNodeIds: [...visitedNodeIds],
    succeededNodeIds: [...succeededNodeIds],
    failedNodeIds: [...failedNodeIds],
    executedEdgeIds: [...executedEdgeIds],
    candidateEdgeIds: [...candidateEdgeIds],
    recognitionEvents,
    actionEvents,
    diagnostics,
    artifacts: [...artifactsById.values()],
    lastEvent,
    nodeStates,
    nodeReplays: groupNodeReplays(nodeReplayBuckets),
  };
}

export function reduceDebugTraceForReplay(
  snapshot: DebugTraceStateSnapshot,
  cursor: DebugTraceReplayCursor,
): DebugTraceSummary {
  if (!cursor.active) return reduceDebugTrace(snapshot);
  const events = snapshot.events.filter((event) => {
    if (event.seq > cursor.cursorSeq) return false;
    if (cursor.runId && event.runId !== cursor.runId) return false;
    if (cursor.nodeId && event.node?.nodeId !== cursor.nodeId) return false;
    return true;
  });
  return reduceDebugTrace({ events });
}

function ensureNodeReplayForEvent({
  activeNodeReplays,
  activeRuntimeReplays,
  event,
  nodeReplayBuckets,
  occurrenceByIdentity,
  runMode,
  status,
}: {
  activeNodeReplays: Map<string, DebugNodeReplay>;
  activeRuntimeReplays: Map<string, DebugNodeReplay>;
  event: DebugEvent;
  nodeReplayBuckets: Map<string, DebugNodeReplay[]>;
  occurrenceByIdentity: Map<string, number>;
  runMode: DebugRunMode | undefined;
  status: DebugNodeRunState["status"];
}): DebugNodeReplay | undefined {
  if (!isNodeScopedEvent(event)) return undefined;

  const startsNewOccurrence =
    event.kind === "node" && event.phase === "starting";
  const active = startsNewOccurrence
    ? undefined
    : findActiveNodeReplay(event, activeNodeReplays, activeRuntimeReplays);
  if (active) return active;

  const identity = resolveNodeReplayIdentity(event);
  if (!identity) return undefined;

  const occurrence = (occurrenceByIdentity.get(identity.identityKey) ?? 0) + 1;
  occurrenceByIdentity.set(identity.identityKey, occurrence);

  const replay: DebugNodeReplay = {
    nodeId: identity.nodeId,
    runtimeName: identity.runtimeName,
    fileId: identity.fileId,
    label: identity.label,
    syntheticKind: identity.syntheticKind,
    runId: event.runId,
    runMode,
    status,
    occurrence,
    firstSeq: event.seq,
    lastSeq: event.seq,
    events: [],
    recognitionEvents: [],
    actionEvents: [],
    nextListEvents: [],
    waitFreezesEvents: [],
    detailRefs: [],
    screenshotRefs: [],
    unmapped: identity.unmapped,
  };
  nodeReplayBuckets.set(identity.bucketKey, [
    ...(nodeReplayBuckets.get(identity.bucketKey) ?? []),
    replay,
  ]);
  activeNodeReplays.set(identity.identityKey, replay);
  activeRuntimeReplays.set(identity.runtimeKey, replay);
  return replay;
}

function findActiveNodeReplay(
  event: DebugEvent,
  activeNodeReplays: Map<string, DebugNodeReplay>,
  activeRuntimeReplays: Map<string, DebugNodeReplay>,
): DebugNodeReplay | undefined {
  const nodeId = event.node?.nodeId ?? dataString(event.data, "nodeId");
  if (nodeId) {
    const current = activeNodeReplays.get(nodeIdentityKey(event.runId, nodeId));
    if (current) return current;
  }

  const parentRuntimeName = dataString(event.data, "parentNode");
  if (parentRuntimeName) {
    const current = activeRuntimeReplays.get(
      runtimeIdentityKey(event.runId, parentRuntimeName),
    );
    if (current) return current;
  }

  if (event.node?.runtimeName) {
    return activeRuntimeReplays.get(
      runtimeIdentityKey(event.runId, event.node.runtimeName),
    );
  }

  return undefined;
}

function resolveNodeReplayIdentity(
  event: DebugEvent,
): NodeReplayIdentity | undefined {
  const parentRuntimeName = dataString(event.data, "parentNode");
  const parentSyntheticKind =
    taskerBootstrapSyntheticKindForRuntime(parentRuntimeName);
  const syntheticKind = event.node?.syntheticKind ?? parentSyntheticKind;
  const runtimeName = resolveIdentityRuntimeName(
    event,
    parentRuntimeName,
    syntheticKind,
  );
  const nodeId = syntheticKind ? undefined : event.node?.nodeId;
  if (!runtimeName && !nodeId) return undefined;

  const resolvedRuntimeName = runtimeName ?? nodeId;
  if (!resolvedRuntimeName) return undefined;

  return {
    identityKey: nodeId
      ? nodeIdentityKey(event.runId, nodeId)
      : runtimeIdentityKey(event.runId, resolvedRuntimeName),
    bucketKey: nodeId ?? `runtime:${resolvedRuntimeName}`,
    runtimeKey: runtimeIdentityKey(event.runId, resolvedRuntimeName),
    nodeId,
    runtimeName: resolvedRuntimeName,
    fileId: syntheticKind ? undefined : event.node?.fileId,
    label:
      syntheticKind && !event.node?.syntheticKind
        ? undefined
        : event.node?.label,
    syntheticKind,
    unmapped: syntheticKind ? false : !nodeId,
  };
}

function resolveIdentityRuntimeName(
  event: DebugEvent,
  parentRuntimeName: string | undefined,
  syntheticKind: DebugSyntheticNodeKind | undefined,
): string | undefined {
  if (syntheticKind) {
    return event.node?.syntheticKind
      ? event.node.runtimeName
      : parentRuntimeName;
  }
  if (event.node?.nodeId) return event.node.runtimeName;
  return parentRuntimeName ?? event.node?.runtimeName;
}

function isNodeScopedEvent(event: DebugEvent): boolean {
  return Boolean(
    event.node?.runtimeName ||
      dataString(event.data, "parentNode") ||
      (event.kind === "diagnostic" && dataString(event.data, "nodeId")),
  );
}

function applyEventToNodeReplay(
  replay: DebugNodeReplay,
  event: DebugEvent,
  status: DebugNodeRunState["status"],
): void {
  replay.events.push(event);
  replay.lastSeq = event.seq;
  replay.status = mergeNodeReplayStatus(replay.status, status);

  if (!isDebugTaskerBootstrapNode(replay)) {
    if (!replay.fileId && event.node?.fileId) replay.fileId = event.node.fileId;
    if (!replay.label && event.node?.label) replay.label = event.node.label;
  }
  if (event.kind === "recognition") replay.recognitionEvents.push(event);
  if (event.kind === "action") replay.actionEvents.push(event);
  if (event.kind === "next-list") replay.nextListEvents.push(event);
  if (event.kind === "wait-freezes") replay.waitFreezesEvents.push(event);
  if (event.detailRef && !replay.detailRefs.includes(event.detailRef)) {
    replay.detailRefs.push(event.detailRef);
  }
  if (
    event.screenshotRef &&
    !replay.screenshotRefs.includes(event.screenshotRef)
  ) {
    replay.screenshotRefs.push(event.screenshotRef);
  }
}

function mergeNodeReplayStatus(
  current: DebugNodeRunState["status"],
  next: DebugNodeRunState["status"],
): DebugNodeRunState["status"] {
  if (current === "failed" || next === "failed") return "failed";
  if (next === "running") return "running";
  if (next === "succeeded") return "succeeded";
  return current === "visited" ? next : current;
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

function nodeIdentityKey(runId: string, nodeId: string): string {
  return `${runId}:node:${nodeId}`;
}

function runtimeIdentityKey(runId: string, runtimeName: string): string {
  return `${runId}:runtime:${runtimeName}`;
}

function groupNodeReplays(
  buckets: Map<string, DebugNodeReplay[]>,
): Record<string, DebugNodeReplay[]> {
  const result: Record<string, DebugNodeReplay[]> = {};
  for (const [key, replays] of buckets.entries()) {
    result[key] = [...replays];
  }
  Object.values(result).forEach((items) =>
    items.sort((a, b) => a.firstSeq - b.firstSeq),
  );
  return result;
}
