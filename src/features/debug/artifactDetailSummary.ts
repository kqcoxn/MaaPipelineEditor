import type { DebugArtifactPayload } from "./types";

export interface DebugArtifactBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DebugArtifactPoint {
  x: number;
  y: number;
}

export interface DebugDetailImageRef {
  ref: string;
  kind: "raw" | "draw" | "screenshot";
  label: string;
}

export interface DebugRecognitionDetailSummary {
  id?: unknown;
  name?: unknown;
  algorithm?: unknown;
  hit?: unknown;
  box?: unknown;
  detail?: unknown;
  detailJson?: unknown;
  rawImageRef?: string;
  drawImageRefs: string[];
  screenshotRef?: string;
  combinedResultCount?: number;
  combinedResult?: unknown[];
  resultGroups: DebugRecognitionResultGroup[];
}

export interface DebugRecognitionResultGroup {
  key: "best" | "filtered" | "all";
  label: string;
  results: DebugRecognitionResultItem[];
}

export interface DebugRecognitionResultItem {
  index: number;
  box?: DebugArtifactBox;
  extra?: Record<string, unknown>;
  raw: unknown;
}

export interface DebugActionDetailSummary {
  id?: unknown;
  name?: unknown;
  action?: unknown;
  success?: unknown;
  box?: unknown;
  detail?: unknown;
  detailJson?: unknown;
}

export function summarizeRecognitionArtifactPayload(
  payload?: DebugArtifactPayload,
): DebugRecognitionDetailSummary | undefined {
  return summarizeRecognitionDetail(payload?.data);
}

export function summarizeActionArtifactPayload(
  payload?: DebugArtifactPayload,
): DebugActionDetailSummary | undefined {
  return summarizeActionDetail(payload?.data);
}

export function summarizeRecognitionDetail(
  value: unknown,
): DebugRecognitionDetailSummary | undefined {
  if (!isRecord(value)) return undefined;
  const combinedResult = Array.isArray(value.combinedResult)
    ? value.combinedResult
    : undefined;
  return {
    id: value.id,
    name: value.name,
    algorithm: value.algorithm,
    hit: value.hit,
    box: value.box,
    detail: value.detail,
    detailJson: value.detailJson,
    rawImageRef: readString(value.rawImageRef),
    drawImageRefs: uniqueStrings(readStringArray(value.drawImageRefs)),
    screenshotRef: readString(value.screenshotRef),
    combinedResultCount: combinedResult?.length,
    combinedResult,
    resultGroups: readRecognitionResultGroups(value.detail),
  };
}

export function summarizeActionDetail(
  value: unknown,
): DebugActionDetailSummary | undefined {
  if (!isRecord(value)) return undefined;
  return {
    id: value.id,
    name: value.name,
    action: value.action,
    success: value.success,
    box: value.box,
    detail: value.detail,
    detailJson: value.detailJson,
  };
}

export function recognitionDetailImageRefs(
  summary: DebugRecognitionDetailSummary | undefined,
): DebugDetailImageRef[] {
  if (!summary) return [];
  const refs: DebugDetailImageRef[] = [];
  if (summary.rawImageRef) {
    refs.push({
      ref: summary.rawImageRef,
      kind: "raw",
      label: "原图",
    });
  }
  summary.drawImageRefs.forEach((ref, index) => {
    refs.push({
      ref,
      kind: "draw",
      label:
        summary.drawImageRefs.length > 1 ? `绘制图 ${index + 1}` : "绘制图",
    });
  });
  if (summary.screenshotRef) {
    refs.push({
      ref: summary.screenshotRef,
      kind: "screenshot",
      label: "截图",
    });
  }
  return dedupeImageRefs(refs);
}

export function formatDebugDetailValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function normalizeDebugArtifactBox(
  value: unknown,
): DebugArtifactBox | undefined {
  const box = Array.isArray(value)
    ? {
        x: value[0],
        y: value[1],
        width: value[2],
        height: value[3],
      }
    : isRecord(value)
      ? {
          x: value.x,
          y: value.y,
          width: value.w ?? value.width,
          height: value.h ?? value.height,
        }
      : undefined;
  if (!box) return undefined;

  const x = readFiniteNumber(box.x);
  const y = readFiniteNumber(box.y);
  const width = readFiniteNumber(box.width);
  const height = readFiniteNumber(box.height);
  if (
    x === undefined ||
    y === undefined ||
    width === undefined ||
    height === undefined ||
    width <= 0 ||
    height <= 0
  ) {
    return undefined;
  }
  return { x, y, width, height };
}

export function normalizeDebugArtifactPoint(
  value: unknown,
): DebugArtifactPoint | undefined {
  const point = Array.isArray(value)
    ? { x: value[0], y: value[1] }
    : isRecord(value)
      ? {
          x: value.x ?? value.left ?? value.cx,
          y: value.y ?? value.top ?? value.cy,
        }
      : undefined;
  if (!point) return undefined;
  const x = readFiniteNumber(point.x);
  const y = readFiniteNumber(point.y);
  if (x === undefined || y === undefined) return undefined;
  return { x, y };
}

export function normalizeDebugArtifactPointList(
  value: unknown,
): DebugArtifactPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeDebugArtifactPoint(item))
    .filter((point): point is DebugArtifactPoint => Boolean(point));
}

function dedupeImageRefs(refs: DebugDetailImageRef[]): DebugDetailImageRef[] {
  const seen = new Set<string>();
  const result: DebugDetailImageRef[] = [];
  for (const ref of refs) {
    if (seen.has(ref.ref)) continue;
    seen.add(ref.ref);
    result.push(ref);
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && item.trim() !== "",
  );
}

function readRecognitionResultGroups(
  detail: unknown,
): DebugRecognitionResultGroup[] {
  if (!isRecord(detail)) return [];
  const groups: DebugRecognitionResultGroup[] = [];
  for (const [key, label] of [
    ["best", "Best"],
    ["filtered", "Filtered"],
    ["all", "All"],
  ] as const) {
    const results = readRecognitionResultItems(detail[key]);
    if (results.length === 0) continue;
    groups.push({ key, label, results });
  }
  return groups;
}

function readRecognitionResultItems(value: unknown): DebugRecognitionResultItem[] {
  const rawItems = Array.isArray(value) ? value : value !== undefined ? [value] : [];
  return rawItems
    .map((item, index) => {
      if (!isRecord(item)) return undefined;
      const box = normalizeDebugArtifactBox(item.box);
      const extra = Object.fromEntries(
        Object.entries(item).filter(([key]) => key !== "box"),
      );
      return {
        index,
        box,
        extra: Object.keys(extra).length > 0 ? extra : undefined,
        raw: item,
      };
    })
    .filter((item): item is DebugRecognitionResultItem => Boolean(item));
}

function readFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
