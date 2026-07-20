import uiT from "../../i18n/translate";
import type {
  DebugEvent,
  DebugEventPhase,
  DebugExecutionAttributionMode,
  DebugExecutionDetailMode,
} from "./types";
import type { DebugArtifactEntry } from "../../stores/debugArtifactStore";
import {
  recognitionDetailImageRefs,
  summarizeRecognitionArtifactPayload,
} from "./artifactDetailSummary";

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
  rawImageRef?: string;
  drawImageRefs: string[];
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

export function terminalDebugNodeExecutionAttempts(input: {
  recognitionAttempts: DebugNodeExecutionAttempt[];
  actionAttempts: DebugNodeExecutionAttempt[];
}): DebugNodeExecutionAttempt[] {
  return allDebugNodeExecutionAttempts(input).filter(
    isTerminalDebugNodeExecutionAttempt,
  );
}

export function selectDebugNodeExecutionAttemptForDetailMode(
  input: {
    recognitionAttempts: DebugNodeExecutionAttempt[];
    actionAttempts: DebugNodeExecutionAttempt[];
  },
  detailMode: DebugExecutionDetailMode,
  attemptId?: string,
): DebugNodeExecutionAttempt | undefined {
  const attempts =
    detailMode === "compact"
      ? terminalDebugNodeExecutionAttempts(input)
      : allDebugNodeExecutionAttempts(input);
  return attempts.find((attempt) => attempt.id === attemptId) ?? attempts[0];
}

export function isTerminalDebugNodeExecutionAttempt(
  attempt: DebugNodeExecutionAttempt,
): boolean {
  return (
    isSuccessfulDebugNodeExecutionAttempt(attempt) ||
    isFailedDebugNodeExecutionAttempt(attempt)
  );
}

export function isSuccessfulDebugNodeExecutionAttempt(
  attempt: DebugNodeExecutionAttempt,
): boolean {
  if (attempt.kind === "recognition") {
    if (attempt.hit !== undefined) return attempt.hit;
    return attempt.phase === "succeeded" || attempt.phase === "completed";
  }
  if (attempt.success !== undefined) return attempt.success;
  return attempt.phase === "succeeded" || attempt.phase === "completed";
}

export function isFailedDebugNodeExecutionAttempt(
  attempt: DebugNodeExecutionAttempt,
): boolean {
  if (attempt.kind === "recognition") {
    if (attempt.hit !== undefined) return !attempt.hit;
    return attempt.phase === "failed" || attempt.status === "failed";
  }
  if (attempt.success !== undefined) return !attempt.success;
  return attempt.phase === "failed" || attempt.status === "failed";
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

export function resolveAutoLoadAttemptArtifact(
  artifacts: Record<string, DebugArtifactEntry>,
  attempt: DebugNodeExecutionAttempt | undefined,
  selectedArtifactId?: string,
): string | undefined {
  if (!attempt) return undefined;

  const imageRefs = collectAutoLoadImageRefs(artifacts, attempt);

  // 如果当前选中的 artifact 在图像 refs 中，检查它是否已加载
  if (selectedArtifactId && imageRefs.includes(selectedArtifactId)) {
    const entry = artifacts[selectedArtifactId];
    // 已存在但尚未加载（且未在加载中），重新请求加载
    if (entry && entry.status !== "ready" && entry.status !== "loading") {
      return selectedArtifactId;
    }
    // 已加载或正在加载，不需要再加载
    return undefined;
  }

  // 优先找一个已存在但尚未加载的图像 ref
  const unloadedImageRef = imageRefs.find((ref) => {
    const entry = artifacts[ref];
    return entry && entry.status !== "ready" && entry.status !== "loading";
  });
  if (unloadedImageRef) {
    return unloadedImageRef;
  }

  // 找一个已存在且已加载的图像 ref（用于自动选中）
  const readyImageRef = imageRefs.find((ref) => {
    const entry = artifacts[ref];
    return entry?.status === "ready" && entry.payload;
  });
  if (readyImageRef) {
    return readyImageRef;
  }

  if (attempt.kind !== "recognition") return undefined;
  const detailRef = attempt.detailRefs.find((ref) => {
    const entry = artifacts[ref];
    return entry?.status !== "ready" && ref !== selectedArtifactId;
  });
  if (!detailRef || selectedArtifactId === detailRef) return undefined;
  return detailRef;
}

function collectAutoLoadImageRefs(
  artifacts: Record<string, DebugArtifactEntry>,
  attempt: DebugNodeExecutionAttempt,
): string[] {
  const refs = new Set<string>();
  if (attempt.kind === "recognition") {
    // 优先从 attempt 本身的 event data 中获取图像 refs（不需要等 detail JSON 加载）
    if (attempt.rawImageRef) {
      refs.add(attempt.rawImageRef);
    }
    for (const ref of attempt.drawImageRefs) {
      refs.add(ref);
    }
    // 再从已加载的 detail JSON payload 中解析（作为补充和兜底）
    for (const detailRef of attempt.detailRefs) {
      const summary = summarizeRecognitionArtifactPayload(
        artifacts[detailRef]?.payload,
      );
      for (const imageRef of recognitionDetailImageRefs(summary)) {
        refs.add(imageRef.ref);
      }
    }
    for (const screenshotRef of attempt.screenshotRefs) {
      refs.add(screenshotRef);
    }
    return [...refs];
  }

  if (attempt.kind === "action") {
    for (const screenshotRef of attempt.screenshotRefs) {
      refs.add(screenshotRef);
    }
  }
  return [...refs];
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
  const rawImageRef = firstDefinedString(sortedEvents, "rawImageRef");
  const drawImageRefs = uniqueStrings(readStringArray(firstDefinedValue(sortedEvents, "drawImageRefs")));

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
    rawImageRef,
    drawImageRefs,
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
          : uiT("ui.debug.nodeExecution.multipleNextList", "多个 NextList"),
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

function readStringArray(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && item.trim() !== "",
  );
}

function uniqueRefs(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ""))];
}
