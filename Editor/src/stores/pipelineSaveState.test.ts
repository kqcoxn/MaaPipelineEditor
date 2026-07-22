import { describe, expect, it } from "vitest";

import type { NodeType } from "./flow";
import {
  createCleanPipelineSaveState,
  createPipelineFingerprint,
} from "./pipelineSaveState";

function source(positionX = 0, selected = false) {
  return {
    fileName: "main",
    nodes: [
      {
        id: "Start",
        type: "pipeline-node",
        data: { label: "Start" },
        position: { x: positionX, y: 0 },
        selected,
        measured: { width: 120, height: 40 },
      } as NodeType,
    ],
    edges: [],
    config: { prefix: "", savedViewport: { x: 0, y: 0, zoom: 1 } },
  };
}

describe("pipelineSaveState", () => {
  it("creates a clean baseline and ignores runtime-only node state", () => {
    const clean = createCleanPipelineSaveState(source());

    expect(clean.dirty).toBe(false);
    expect(clean.savedFingerprint).toBe(
      createPipelineFingerprint(source(0, true)),
    );
  });

  it("includes persisted layout changes in the fingerprint", () => {
    expect(createPipelineFingerprint(source(0))).not.toBe(
      createPipelineFingerprint(source(20)),
    );
  });

  it("normalizes nested object key order", () => {
    const left = source();
    const right = source();
    left.nodes[0].data = { label: "Start", extras: { alpha: 1, beta: 2 } } as never;
    right.nodes[0].data = { label: "Start", extras: { beta: 2, alpha: 1 } } as never;

    expect(createPipelineFingerprint(left)).toBe(
      createPipelineFingerprint(right),
    );
  });
});
