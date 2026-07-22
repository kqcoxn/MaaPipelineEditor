import { describe, expect, it } from "vitest";

import { buildPipelineProjection } from "./pipelineProjectionBuilder";
import { layoutPipelineProjection } from "./pipelineProjectionLayout";

describe("Pipeline Flow projection", () => {
  it("uses stable source-derived ids without mutating the input", () => {
    const input = {
      Start: { next: "End", extension: { keep: true } },
      End: {},
    };
    const snapshot = structuredClone(input);

    const first = buildPipelineProjection({ pipeline: input });
    const second = buildPipelineProjection({
      pipeline: { Start: { timeout: 1, next: "End" }, End: {} },
    });

    expect(input).toEqual(snapshot);
    expect(first.nodes.find((node) => node.data.label === "Start")?.id).toBe(
      second.nodes.find((node) => node.data.label === "Start")?.id,
    );
    expect(first.edges[0].id).toBe(second.edges[0].id);
  });

  it("lays out projections without authored positions and leaves the source projection immutable", async () => {
    const projection = buildPipelineProjection({
      pipeline: { Start: { next: "End" }, End: {} },
    });
    const originalPositions = projection.nodes.map((node) => ({ ...node.position }));

    const layouted = await layoutPipelineProjection(projection);

    expect(projection.nodes.map((node) => node.position)).toEqual(originalPositions);
    expect(new Set(layouted.nodes.map((node) => `${node.position.x}:${node.position.y}`)).size).toBe(
      layouted.nodes.length,
    );
  });
});
