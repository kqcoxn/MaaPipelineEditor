import type {
  DebugArtifactRef,
  DebugDiagnostic,
  DebugEvent,
  DebugEventKind,
  DebugRunMode,
  DebugSessionStatus,
} from "./types";

export interface DebugNodeRunState {
  nodeId: string;
  runtimeName: string;
  label?: string;
  fileId?: string;
  status: "running" | "succeeded" | "failed" | "visited";
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

    const nodeId = event.node?.nodeId;
    if (nodeId) {
      addUnique(visitedNodeIds, nodeId);
      currentNodeId = nodeId;
      currentRuntimeName = event.node?.runtimeName;

      const nodeStatus = resolveNodeStatus(event.kind, event.phase);
      nodeStates[nodeId] = {
        nodeId,
        runtimeName: event.node?.runtimeName ?? nodeId,
        label: event.node?.label,
        fileId: event.node?.fileId,
        status: nodeStatus,
        lastSeq: event.seq,
      };

      if (nodeStatus === "succeeded") addUnique(succeededNodeIds, nodeId);
      if (nodeStatus === "failed") addUnique(failedNodeIds, nodeId);
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
  };
}
