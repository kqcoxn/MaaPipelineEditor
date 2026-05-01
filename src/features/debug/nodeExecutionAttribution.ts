import type { DebugTraceSummary } from "./traceReducer";
import type {
  DebugEvent,
  DebugNodeExecutionStatus,
  DebugNodeResolverSnapshot,
  DebugRunMode,
  DebugSyntheticNodeKind,
} from "./types";
import { isDebugTaskerBootstrapNode } from "./syntheticNode";

type ResolverNode = DebugNodeResolverSnapshot["nodes"][number];

export interface DebugNodeExecutionRecordSeed {
  nodeId?: string;
  runtimeName: string;
  fileId?: string;
  label?: string;
  syntheticKind?: DebugSyntheticNodeKind;
  runId: string;
  runMode?: DebugRunMode;
  status?: DebugNodeExecutionStatus;
  occurrence: number;
  events: DebugEvent[];
  unmapped?: boolean;
}

interface MutableNodeAttributionRecord
  extends Omit<DebugNodeExecutionRecordSeed, "occurrence" | "status"> {
  closed: boolean;
}

export function selectNodeAttributionRecordSeeds(
  summary: DebugTraceSummary,
  nodeById: Map<string, ResolverNode>,
  nodeByRuntime: Map<string, ResolverNode>,
): DebugNodeExecutionRecordSeed[] {
  const records: MutableNodeAttributionRecord[] = [];
  const activeRecords = new Map<string, MutableNodeAttributionRecord>();
  const runMode = summary.runMode;

  for (const event of traceEventsFromSummary(summary)) {
    const identity = resolveNodeAttributionIdentity(event, nodeById, nodeByRuntime);
    const key = identity ? recordIdentityKey(event.runId, identity) : undefined;
    if (shouldClosePendingRecognitionBefore(event)) {
      closeStalePendingRecognitionRecords(activeRecords, key);
    }
    if (!identity || !key) continue;

    const startsNewOccurrence =
      event.kind === "node" &&
      event.phase === "starting" &&
      !canReusePendingRecognition(activeRecords.get(key));
    let record = startsNewOccurrence ? undefined : activeRecords.get(key);
    if (!record || record.closed) {
      record = {
        ...identity,
        runId: event.runId,
        runMode,
        events: [],
        closed: false,
      };
      records.push(record);
      activeRecords.set(key, record);
    } else {
      mergeRecordIdentity(record, identity);
    }

    record.events.push(event);
    if (isRecordClosedByEvent(event)) {
      record.closed = true;
      activeRecords.delete(key);
    }
  }

  const occurrenceByIdentity = new Map<string, number>();
  return records.map((record) => {
    const identityKey = recordIdentityKey(record.runId, record);
    const occurrence = (occurrenceByIdentity.get(identityKey) ?? 0) + 1;
    occurrenceByIdentity.set(identityKey, occurrence);
    return {
      ...record,
      occurrence,
      status: resolveRecordStatus(record.events),
      unmapped:
        record.unmapped ?? (!record.syntheticKind && !record.nodeId),
    };
  });
}

function traceEventsFromSummary(summary: DebugTraceSummary): DebugEvent[] {
  const eventsByKey = new Map<string, DebugEvent>();
  for (const replay of Object.values(summary.nodeReplays).flat()) {
    for (const event of replay.events) {
      eventsByKey.set(`${event.runId}:${event.seq}:${event.kind}`, event);
    }
  }
  return [...eventsByKey.values()].sort((a, b) =>
    a.seq === b.seq ? a.kind.localeCompare(b.kind) : a.seq - b.seq,
  );
}

function resolveNodeAttributionIdentity(
  event: DebugEvent,
  nodeById: Map<string, ResolverNode>,
  nodeByRuntime: Map<string, ResolverNode>,
): Omit<MutableNodeAttributionRecord, "runId" | "runMode" | "events" | "closed"> | undefined {
  if (event.kind === "recognition" && event.node?.runtimeName) {
    return identityFromEventNode(event, nodeById, nodeByRuntime);
  }
  if (
    (event.kind === "node" ||
      event.kind === "action" ||
      event.kind === "next-list" ||
      event.kind === "wait-freezes") &&
    event.node?.runtimeName
  ) {
    return identityFromEventNode(event, nodeById, nodeByRuntime);
  }
  if (event.kind === "diagnostic") {
    const nodeId = dataString(event.data, "nodeId");
    const resolverNode = nodeId ? nodeById.get(nodeId) : undefined;
    if (resolverNode) {
      return {
        nodeId: resolverNode.nodeId,
        runtimeName: resolverNode.runtimeName,
        fileId: resolverNode.fileId,
        label: resolverNode.displayName,
      };
    }
  }
  return undefined;
}

function identityFromEventNode(
  event: DebugEvent,
  nodeById: Map<string, ResolverNode>,
  nodeByRuntime: Map<string, ResolverNode>,
): Omit<MutableNodeAttributionRecord, "runId" | "runMode" | "events" | "closed"> | undefined {
  const runtimeName = event.node?.runtimeName;
  if (!runtimeName) return undefined;
  const syntheticKind = event.node.syntheticKind;
  const syntheticNode = isDebugTaskerBootstrapNode({
    runtimeName,
    syntheticKind,
  });
  const resolverNode =
    (event.node.nodeId ? nodeById.get(event.node.nodeId) : undefined) ??
    nodeByRuntime.get(runtimeName);
  return {
    nodeId: syntheticNode ? undefined : event.node.nodeId ?? resolverNode?.nodeId,
    runtimeName,
    fileId: syntheticNode ? undefined : event.node.fileId ?? resolverNode?.fileId,
    label: resolverNode?.displayName ?? event.node.label,
    syntheticKind,
    unmapped: syntheticNode
      ? false
      : !(event.node.nodeId ?? resolverNode?.nodeId),
  };
}

function canReusePendingRecognition(
  record: MutableNodeAttributionRecord | undefined,
): boolean {
  if (!record || record.closed) return false;
  return record.events.every((event) => event.kind === "recognition");
}

function closeStalePendingRecognitionRecords(
  activeRecords: Map<string, MutableNodeAttributionRecord>,
  currentKey: string | undefined,
): void {
  for (const [key, record] of activeRecords) {
    if (key === currentKey || !canReusePendingRecognition(record)) continue;
    record.closed = true;
    activeRecords.delete(key);
  }
}

function shouldClosePendingRecognitionBefore(event: DebugEvent): boolean {
  return (
    event.kind === "recognition" ||
    event.kind === "task" ||
    event.kind === "session"
  );
}

function mergeRecordIdentity(
  record: MutableNodeAttributionRecord,
  identity: Omit<
    MutableNodeAttributionRecord,
    "runId" | "runMode" | "events" | "closed"
  >,
): void {
  record.nodeId = record.nodeId ?? identity.nodeId;
  record.fileId = record.fileId ?? identity.fileId;
  record.label = record.label ?? identity.label;
  record.syntheticKind = record.syntheticKind ?? identity.syntheticKind;
  record.unmapped = record.unmapped && identity.unmapped;
}

function isRecordClosedByEvent(event: DebugEvent): boolean {
  if (event.kind !== "node") return false;
  return (
    event.phase === "succeeded" ||
    event.phase === "failed" ||
    event.phase === "completed"
  );
}

function resolveRecordStatus(events: DebugEvent[]): DebugNodeExecutionStatus {
  if (
    events.some(
      (event) => event.phase === "failed" || event.status === "failed",
    )
  ) {
    return "failed";
  }
  const hasRunning = events.some((event) => event.phase === "starting");
  const hasTerminal = events.some(
    (event) => event.phase === "succeeded" || event.phase === "completed",
  );
  const hasAction = events.some((event) => event.kind === "action");
  const hasHitRecognition = events.some(
    (event) => event.kind === "recognition" && dataBoolean(event.data, "hit"),
  );
  if (hasTerminal || hasAction || hasHitRecognition) return "succeeded";
  if (hasRunning) return "running";
  return "visited";
}

function recordIdentityKey(
  runId: string,
  identity: Pick<MutableNodeAttributionRecord, "nodeId" | "runtimeName">,
): string {
  return identity.nodeId
    ? `${runId}:node:${identity.nodeId}`
    : `${runId}:runtime:${identity.runtimeName}`;
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
