import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { NodeChange, XYPosition } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LayoutHelper } from "../layout";
import {
  getNodeAbsolutePosition,
  useFlowStore,
} from "../../stores/flow";
import { pipelineToFlow, resetIdCounter } from ".";

const DATASET_CASES = [
  { fileName: "performance-small-100.json", nodes: 100, edges: 200 },
  { fileName: "performance-medium-200.json", nodes: 200, edges: 500 },
  { fileName: "performance-large-300.json", nodes: 300, edges: 900 },
] as const;

const DRAG_SAMPLE_COUNT = 300;

function createDragPositions(origin: XYPosition): XYPosition[] {
  const segmentSamples = DRAG_SAMPLE_COUNT / 3;

  return Array.from({ length: DRAG_SAMPLE_COUNT }, (_, index) => {
    if (index < segmentSamples) {
      const progress = (index + 1) / segmentSamples;
      return { x: origin.x + 600 * progress, y: origin.y };
    }

    if (index < segmentSamples * 2) {
      const progress = (index - segmentSamples + 1) / segmentSamples;
      return { x: origin.x + 600, y: origin.y + 300 * progress };
    }

    const progress = (index - segmentSamples * 2 + 1) / segmentSamples;
    return {
      x: origin.x + 600 * (1 - progress),
      y: origin.y + 300 * (1 - progress),
    };
  });
}

function percentile(samples: number[], ratio: number): number {
  const sortedSamples = [...samples].sort((left, right) => left - right);
  const index = Math.ceil(sortedSamples.length * ratio) - 1;
  return sortedSamples[Math.max(index, 0)];
}

describe("PERF-001 performance datasets", () => {
  beforeEach(() => {
    resetIdCounter();
    useFlowStore.setState({
      nodes: [],
      edges: [],
      selectedNodes: [],
      selectedEdges: [],
      historyStack: [],
      historyIndex: -1,
      lastSnapshot: null,
      instance: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(DATASET_CASES)(
    "imports $nodes nodes and $edges edges without auto layout",
    async ({ fileName, nodes, edges }) => {
      const datasetPath = resolve(
        process.cwd(),
        `../dev/performance/editor/datasets/${fileName}`,
      );
      const pipelineText = await readFile(datasetPath, "utf8");
      const pipeline = JSON.parse(pipelineText) as Record<string, any>;
      const expectedPosition = pipeline.Perf_Node_0001.$__mpe_code.position;
      const autoLayout = vi.spyOn(LayoutHelper, "auto");

      const startedAt = performance.now();
      const imported = await pipelineToFlow({ pString: pipelineText });
      const elapsedMs = performance.now() - startedAt;
      const flowState = useFlowStore.getState();
      const firstNode = flowState.nodes.find(
        (node) => node.data.label === "Perf_Node_0001",
      );

      expect(imported).toBe(true);
      expect(flowState.nodes).toHaveLength(nodes);
      expect(flowState.edges).toHaveLength(edges);
      expect(autoLayout).not.toHaveBeenCalled();
      expect(firstNode).toBeDefined();
      expect(getNodeAbsolutePosition(firstNode!, flowState.nodes)).toEqual(
        expectedPosition,
      );
      expect(elapsedMs).toBeLessThan(10_000);

      console.info(
        `[PERF-001] ${fileName}: ${elapsedMs.toFixed(2)} ms import`,
      );
    },
    30_000,
  );

  it("measures the 300-node drag state-update hot path", async () => {
    const datasetPath = resolve(
      process.cwd(),
      "../dev/performance/editor/datasets/performance-large-300.json",
    );
    const pipelineText = await readFile(datasetPath, "utf8");

    expect(await pipelineToFlow({ pString: pipelineText })).toBe(true);

    const draggedNode = useFlowStore
      .getState()
      .nodes.find((node) => node.data.label === "Perf_Node_0050");
    expect(draggedNode).toBeDefined();

    const dragPositions = createDragPositions(draggedNode!.position);
    const createPositionChange = (
      position: XYPosition,
      dragging: boolean,
    ): NodeChange => ({
      type: "position",
      id: draggedNode!.id,
      position,
      dragging,
    });

    for (const position of dragPositions.slice(0, 30)) {
      useFlowStore
        .getState()
        .updateNodes([createPositionChange(position, true)]);
    }

    const runTotals: number[] = [];
    const updateDurations: number[] = [];
    for (let runIndex = 0; runIndex < 3; runIndex += 1) {
      const runStartedAt = performance.now();
      for (const position of dragPositions) {
        const updateStartedAt = performance.now();
        useFlowStore
          .getState()
          .updateNodes([createPositionChange(position, true)]);
        updateDurations.push(performance.now() - updateStartedAt);
      }
      runTotals.push(performance.now() - runStartedAt);
    }

    const releaseStartedAt = performance.now();
    useFlowStore
      .getState()
      .updateNodes([createPositionChange(dragPositions.at(-1)!, false)]);
    const releaseScheduleDuration = performance.now() - releaseStartedAt;
    await new Promise((resolve) => setTimeout(resolve, 0));
    const releaseSettledDuration = performance.now() - releaseStartedAt;

    expect(useFlowStore.getState().nodes).toHaveLength(300);
    expect(useFlowStore.getState().historyStack).toHaveLength(1);
    expect(Math.max(...runTotals)).toBeLessThan(10_000);

    console.info(
      `[PERF-001] DRAG-01 state only: runs=${runTotals
        .map((duration) => duration.toFixed(2))
        .join("/")} ms, update-p95=${percentile(updateDurations, 0.95).toFixed(
        3,
      )} ms, release-schedule=${releaseScheduleDuration.toFixed(
        3,
      )} ms, release-settled=${releaseSettledDuration.toFixed(3)} ms`,
    );
  });
});
