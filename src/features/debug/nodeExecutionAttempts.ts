import type {
  DebugEvent,
  DebugEventPhase,
  DebugExecutionAttributionMode,
} from "./types";

export type DebugNodeExecutionAttemptKind = "recognition" | "action";

export interface DebugNodeExecutionAttempt {
  id: string;
  kind: DebugNodeExecutionAttemptKind;
  dataId?: string;
  phase?: DebugEventPhase;
  status?: string;
  firstSeq: number;
  lastSeq: number;
  detailRef?: string;
  screenshotRef?: string;
  detailRefs: string[];
  screenshotRefs: string[];
  maafwMessage?: string;
  maafwMessages: string[];
  targetRuntimeName?: string;
  sourceNextOwnerRuntimeName?: string;
  sourceNextOwnerLabel?: string;
  hit?: boolean;
  algorithm?: unknown;
  box?: unknown;
  action?: unknown;
  success?: boolean;
  events: DebugEvent[];
}

export function buildDebugNodeExecutionAttempts({
  attributionMode,
  events,
  kind,
  recordId,
  recordRuntimeName,
  resolveSourceNextOwnerLabel,
  sourceNextOwnerLabel,
}: {
  attributionMode: DebugExecutionAttributionMode;
  events: DebugEvent[];
  kind: DebugNodeExecutionAttemptKind;
  recordId: string;
  recordRuntimeName: string;
  resolveSourceNextOwnerLabel?: (runtimeName: string) => string;
  sourceNextOwnerLabel?: string;
}): DebugNodeExecutionAttempt[] {
  const groups = new Map<string, DebugEvent[]>();
  const order: string[] = [];

  for (const event of [...events].sort((a, b) => a.seq - b.seq)) {
    const dataId = dataString(event.data, "id");
    const key = dataId ? `id:${dataId}` : `seq:${event.seq}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)?.push(event);
  }

  return order
    .map((key) =>
      toAttempt({
        attributionMode,
        events: groups.get(key) ?? [],
        kind,
        recordId,
        recordRuntimeName,
        resolveSourceNextOwnerLabel,
        sourceNextOwnerLabel,
      }),
    )
    .filter((attempt): attempt is DebugNodeExecutionAttempt =>
      Boolean(attempt),
    );
}

export function allDebugNodeExecutionAttempts(input: {
  recognitionAttempts: DebugNodeExecutionAttempt[];
  actionAttempts: DebugNodeExecutionAttempt[];
}): DebugNodeExecutionAttempt[] {
  return [
    ...input.recognitionAttempts,
    ...input.actionAttempts,
  ].sort((a, b) =>
    a.firstSeq === b.firstSeq ? a.kind.localeCompare(b.kind) : a.firstSeq - b.firstSeq,
  );
}

export function isArtifactRelatedToAttempt(
  artifactId: string | undefined,
  attempt: DebugNodeExecutionAttempt | undefined,
): boolean {
  if (!artifactId || !attempt) return false;
  return (
    attempt.detailRefs.includes(artifactId) ||
    attempt.screenshotRefs.includes(artifactId)
  );
}

function toAttempt({
  attributionMode,
  events,
  kind,
  recordId,
  recordRuntimeName,
  resolveSourceNextOwnerLabel,
  sourceNextOwnerLabel,
}: {
  attributionMode: DebugExecutionAttributionMode;
  events: DebugEvent[];
  kind: DebugNodeExecutionAttemptKind;
  recordId: string;
  recordRuntimeName: string;
  resolveSourceNextOwnerLabel?: (runtimeName: string) => string;
  sourceNextOwnerLabel?: string;
}): DebugNodeExecutionAttempt | undefined {
  const sortedEvents = [...events].sort((a, b) => a.seq - b.seq);
  const firstEvent = sortedEvents[0];
  const lastEvent = sortedEvents[sortedEvents.length - 1];
  if (!firstEvent || !lastEvent) return undefined;

  const dataId = firstDefinedString(sortedEvents, "id");
  const detailRefs = uniqueRefs(sortedEvents.map((event) => event.detailRef));
  const screenshotRefs = uniqueRefs(
    sortedEvents.map((event) => event.screenshotRef),
  );
  const maafwMessages = uniqueStrings(
    sortedEvents
      .map((event) => event.maafwMessage)
      .filter((value): value is string => Boolean(value)),
  );
  const targetRuntimeNames = uniqueStrings(
    sortedEvents
      .map((event) => event.node?.runtimeName)
      .filter((value): value is string => Boolean(value)),
  );
  const sourceNextOwnerRuntimeNames =
    kind === "recognition" && attributionMode === "node"
      ? uniqueStrings(
          sortedEvents
            .map((event) => dataString(event.data, "parentNode"))
            .filter(
              (value): value is string =>
                Boolean(value) && value !== recordRuntimeName,
            ),
        )
      : [];
  const terminalEvent =
    [...sortedEvents]
      .reverse()
      .find(
        (event) =>
          event.phase === "succeeded" ||
          event.phase === "failed" ||
          event.phase === "completed",
      ) ?? lastEvent;
  const firstSeq = firstEvent.seq;
  const lastSeq = lastEvent.seq;
  const detailRef = detailRefs[detailRefs.length - 1];
  const screenshotRef = screenshotRefs[screenshotRefs.length - 1];

  return {
    id: `${recordId}:${kind}:${firstSeq}-${lastSeq}:${
      dataId ? `id:${dataId}` : `seq:${firstSeq}`
    }`,
    kind,
    dataId,
    phase: terminalEvent.phase ?? lastEvent.phase,
    status: terminalEvent.status ?? lastEvent.status,
    firstSeq,
    lastSeq,
    detailRef,
    screenshotRef,
    detailRefs,
    screenshotRefs,
    maafwMessage: maafwMessages.join(" / ") || undefined,
    maafwMessages,
    targetRuntimeName:
      targetRuntimeNames.length === 1 ? targetRuntimeNames[0] : undefined,
    sourceNextOwnerRuntimeName:
      sourceNextOwnerRuntimeNames.length === 1
        ? sourceNextOwnerRuntimeNames[0]
        : undefined,
    sourceNextOwnerLabel:
      sourceNextOwnerRuntimeNames.length === 0
        ? undefined
        : sourceNextOwnerRuntimeNames.length === 1
          ? resolveSourceNextOwnerLabel?.(sourceNextOwnerRuntimeNames[0]) ??
            sourceNextOwnerLabel ??
            sourceNextOwnerRuntimeNames[0]
          : "多个 NextList",
    hit: readAttemptHit(sortedEvents),
    algorithm: firstDefinedValue(sortedEvents, "algorithm"),
    box: firstDefinedValue(sortedEvents, "box"),
    action: firstDefinedValue(sortedEvents, "action"),
    success: firstDefinedBoolean(sortedEvents, "success"),
    events: sortedEvents,
  };
}

function readAttemptHit(events: DebugEvent[]): boolean | undefined {
  const hit = firstDefinedBoolean(events, "hit");
  if (hit !== undefined) return hit;
  if (
    events.some(
      (event) => event.phase === "failed" || event.status === "failed",
    )
  ) {
    return false;
  }
  return undefined;
}

function firstDefinedString(
  events: DebugEvent[],
  key: string,
): string | undefined {
  const value = firstDefinedValue(events, key);
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

function firstDefinedBoolean(
  events: DebugEvent[],
  key: string,
): boolean | undefined {
  const value = firstDefinedValue(events, key);
  return typeof value === "boolean" ? value : undefined;
}

function firstDefinedValue(
  events: DebugEvent[],
  key: string,
): unknown | undefined {
  for (const event of [...events].reverse()) {
    const value = event.data?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
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

function uniqueRefs(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ""))];
}
