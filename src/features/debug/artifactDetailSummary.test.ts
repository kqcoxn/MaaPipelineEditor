import { describe, expect, it } from "vitest";
import {
  formatDebugDetailValue,
  recognitionDetailImageRefs,
  summarizeActionArtifactPayload,
  summarizeRecognitionArtifactPayload,
} from "./artifactDetailSummary";
import type { DebugArtifactPayload } from "./types";

describe("artifactDetailSummary", () => {
  it("summarizes recognition detail and dedupes image refs", () => {
    const summary = summarizeRecognitionArtifactPayload(
      payload({
        id: 12,
        name: "Start",
        algorithm: "TemplateMatch",
        hit: true,
        box: { x: 1, y: 2, w: 3, h: 4 },
        detail: { score: 0.98 },
        detailJson: "{\"score\":0.98}",
        rawImageRef: "raw-1",
        drawImageRefs: ["draw-1", "", "draw-1", "draw-2", 42],
        screenshotRef: "raw-1",
        combinedResult: [{ id: 1 }, { id: 2 }],
      }),
    );

    expect(summary).toMatchObject({
      id: 12,
      name: "Start",
      algorithm: "TemplateMatch",
      hit: true,
      box: { x: 1, y: 2, w: 3, h: 4 },
      detail: { score: 0.98 },
      detailJson: "{\"score\":0.98}",
      rawImageRef: "raw-1",
      drawImageRefs: ["draw-1", "draw-2"],
      screenshotRef: "raw-1",
      combinedResultCount: 2,
    });
    expect(recognitionDetailImageRefs(summary)).toEqual([
      { ref: "raw-1", kind: "raw", label: "原图" },
      { ref: "draw-1", kind: "draw", label: "绘制图 1" },
      { ref: "draw-2", kind: "draw", label: "绘制图 2" },
    ]);
  });

  it("summarizes action detail shallow fields", () => {
    const summary = summarizeActionArtifactPayload(
      payload({
        id: 7,
        name: "TapConfirm",
        action: "Click",
        success: false,
        box: [10, 20, 30, 40],
        detail: { reason: "blocked" },
        detailJson: "{\"reason\":\"blocked\"}",
      }),
    );

    expect(summary).toEqual({
      id: 7,
      name: "TapConfirm",
      action: "Click",
      success: false,
      box: [10, 20, 30, 40],
      detail: { reason: "blocked" },
      detailJson: "{\"reason\":\"blocked\"}",
    });
  });

  it("safely ignores malformed payload data", () => {
    expect(summarizeRecognitionArtifactPayload(payload(null))).toBeUndefined();
    expect(summarizeRecognitionArtifactPayload(payload("raw"))).toBeUndefined();
    expect(summarizeActionArtifactPayload(undefined)).toBeUndefined();
    expect(recognitionDetailImageRefs(undefined)).toEqual([]);
  });

  it("formats unknown detail values without throwing", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(formatDebugDetailValue(undefined)).toBe("-");
    expect(formatDebugDetailValue(true)).toBe("true");
    expect(formatDebugDetailValue({ hit: true })).toBe("{\"hit\":true}");
    expect(formatDebugDetailValue(circular)).toBe("[object Object]");
  });
});

function payload(data: unknown): DebugArtifactPayload {
  return {
    ref: {
      id: "detail-1",
      sessionId: "session-1",
      type: "recognition-detail",
      mime: "application/json",
      createdAt: "2026-04-29T00:00:00.000Z",
    },
    data,
  };
}
