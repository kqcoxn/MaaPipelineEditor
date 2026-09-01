import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { NodeChange, XYPosition } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LayoutHelper } from "../layout";
import { NodeTypeEnum } from "../../components/flow/nodes";
import {
  getNodeAbsolutePosition,
  useFlowStore,
} from "../../stores/flow";
import {
  buildAvoidanceNodeBounds,
  buildParallelEdgeInfo,
} from "../avoidanceUtils";
import {
  AvoidanceRouteCache,
  type AvoidanceRouteRequest,
} from "../avoidanceRoutingCache";
import { pipelineToFlow } from ".";
import { serializeFileForCache } from "../../stores/project/fileCache";
import type { FileType } from "../../stores/project/fileStore";
import {
  buildSnapAlignmentIndex,
  findSnapAlignmentWithIndex,
} from "../snapUtils";
import { buildIncrementalSelectionChanges } from "../../stores/flow/utils/selectionUtils";

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
    useFlowStore.setState({
      nodes: [],
      edges: [],
      selectedNodes: [],
      selectedEdges: [],
      historyStack: [],
      historyIndex: -1,
      instance: null,
    });
    useFlowStore.getState().clearHistory();
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
      expect(
        flowState.nodes.every((node) => /^node_[1-9]\d*$/.test(node.id)),
      ).toBe(true);
      expect(
        flowState.edges.every((edge) => /^edge_[1-9]\d*$/.test(edge.id)),
      ).toBe(true);
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

  it("measures PERF-009 patch history on 100 committed moves", async () => {
    const datasetPath = resolve(
      process.cwd(),
      "../dev/performance/editor/datasets/performance-large-300.json",
    );
    const pipelineText = await readFile(datasetPath, "utf8");
    expect(await pipelineToFlow({ pString: pipelineText })).toBe(true);

    const initialState = useFlowStore.getState();
    const draggedNode = initialState.nodes.find(
      (node) => node.data.label === "Perf_Node_0050",
    );
    expect(draggedNode).toBeDefined();
    const legacySnapshotBytes = JSON.stringify({
      nodes: initialState.nodes,
      edges: initialState.edges,
    }).length;

    for (let index = 1; index <= 100; index += 1) {
      useFlowStore.getState().updateNodes([
        {
          type: "position",
          id: draggedNode!.id,
          position: {
            x: draggedNode!.position.x + index * 3,
            y: draggedNode!.position.y + index * 2,
          },
          dragging: false,
        },
      ]);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const historyStack = useFlowStore.getState().historyStack;
    const patchEntries = historyStack.filter(
      (entry) => entry.kind === "patch",
    );
    expect(historyStack).toHaveLength(100);
    expect(patchEntries).toHaveLength(99);
    expect(
      patchEntries.every(
        (entry) =>
          entry.kind === "patch" &&
          entry.patch.nodes.length === 1 &&
          entry.patch.edges.length === 0,
      ),
    ).toBe(true);

    const patchHistoryBytes = JSON.stringify(historyStack).length;
    const legacyHistoryBytes = legacySnapshotBytes * historyStack.length;
    expect(patchHistoryBytes).toBeLessThan(legacyHistoryBytes / 10);
    console.info(
      `[PERF-009] 300-node/100-move history: ${legacyHistoryBytes}->${patchHistoryBytes} serialized bytes, entries=${historyStack.length}`,
    );
  });

  it("measures PERF-010 single-file cache serialization", async () => {
    const datasetPath = resolve(
      process.cwd(),
      "../dev/performance/editor/datasets/performance-large-300.json",
    );
    const pipelineText = await readFile(datasetPath, "utf8");
    expect(await pipelineToFlow({ pString: pipelineText })).toBe(true);

    const flowState = useFlowStore.getState();
    const openFiles: FileType[] = Array.from({ length: 5 }, (_, index) => ({
      fileName: `pipeline-${index}`,
      nodes: flowState.nodes,
      edges: flowState.edges,
      config: { prefix: "" },
    }));
    const legacyBytes = JSON.stringify(
      openFiles.map(serializeFileForCache),
    ).length;
    const changedFileBytes = JSON.stringify(
      serializeFileForCache({
        ...openFiles[0],
        nodes: openFiles[0].nodes.map((node, index) =>
          index === 0
            ? { ...node, position: { x: node.position.x + 10, y: node.position.y } }
            : node,
        ),
      }),
    ).length;

    expect(changedFileBytes).toBeLessThan(legacyBytes / 4);
    console.info(
      `[PERF-010] 300-node/900-edge cache serialization: all-5-files=${legacyBytes} bytes, dirty-file=${changedFileBytes} bytes`,
    );
  });

  it("measures PERF-004 indexed selector fan-out", async () => {
    const datasetPath = resolve(
      process.cwd(),
      "../dev/performance/editor/datasets/performance-large-300.json",
    );
    const pipelineText = await readFile(datasetPath, "utf8");

    expect(await pipelineToFlow({ pString: pipelineText })).toBe(true);
    const state = useFlowStore.getState();
    const legacyFlowTagEdgeVisits = state.nodes.length * state.edges.length;
    const indexedFlowTagEdgeVisits = state.nodes.reduce(
      (total, node) =>
        total + (state.outgoingEdgeIdsByNodeId.get(node.id)?.length ?? 0),
      0,
    );
    const legacyFocusEdgeVisits = state.nodes.length * state.edges.length;
    const indexedFocusEdgeVisits = state.nodes.reduce(
      (total, node) =>
        total +
        (state.outgoingEdgeIdsByNodeId.get(node.id)?.length ?? 0) +
        (state.incomingEdgeIdsByNodeId.get(node.id)?.length ?? 0),
      0,
    );
    const replicaNodeCount = state.nodes.filter(
      (node) =>
        node.type === NodeTypeEnum.Anchor ||
        node.type === NodeTypeEnum.External,
    ).length;
    const legacyReplicaNodeVisits = replicaNodeCount * state.nodes.length;
    const indexedReplicaLookups = replicaNodeCount;

    expect(indexedFlowTagEdgeVisits).toBe(state.edges.length);
    expect(indexedFocusEdgeVisits).toBe(state.edges.length * 2);
    expect(indexedReplicaLookups).toBeLessThan(legacyReplicaNodeVisits);
    console.info(
      `[PERF-004] large selector visits: flow-tags=${legacyFlowTagEdgeVisits}->${indexedFlowTagEdgeVisits}, focus=${legacyFocusEdgeVisits}->${indexedFocusEdgeVisits}, replicas=${legacyReplicaNodeVisits}->${indexedReplicaLookups}`,
    );
  });

  it("measures PERF-005A shared avoidance inputs", async () => {
    const datasetPath = resolve(
      process.cwd(),
      "../dev/performance/editor/datasets/performance-large-300.json",
    );
    const pipelineText = await readFile(datasetPath, "utf8");

    expect(await pipelineToFlow({ pString: pipelineText })).toBe(true);
    const state = useFlowStore.getState();
    const nodeBounds = buildAvoidanceNodeBounds(state.nodes);
    const parallelEdgeInfo = buildParallelEdgeInfo(state.edges);

    expect(nodeBounds).toHaveLength(
      state.nodes.filter((node) => node.type !== NodeTypeEnum.Group).length,
    );
    expect(parallelEdgeInfo.size).toBe(state.edges.length);

    // 旧路径在每条边中重复构建这两份公共输入；画布级上下文各构建一次。
    const legacyBoundsBuilds = state.edges.length;
    const sharedBoundsBuilds = 1;
    const legacyParallelGroupBuilds = state.edges.length;
    const sharedParallelGroupBuilds = 1;
    expect(sharedBoundsBuilds).toBeLessThan(legacyBoundsBuilds);
    expect(sharedParallelGroupBuilds).toBeLessThan(legacyParallelGroupBuilds);

    console.info(
      `[PERF-005A] large shared inputs: bounds-builds=${legacyBoundsBuilds}->${sharedBoundsBuilds}, parallel-groups=${legacyParallelGroupBuilds}->${sharedParallelGroupBuilds}, bounds=${nodeBounds.length}, edges=${parallelEdgeInfo.size}`,
    );
  });

  it("measures PERF-005B avoidance result cache reuse", async () => {
    const datasetPath = resolve(
      process.cwd(),
      "../dev/performance/editor/datasets/performance-large-300.json",
    );
    const pipelineText = await readFile(datasetPath, "utf8");

    expect(await pipelineToFlow({ pString: pipelineText })).toBe(true);
    const state = useFlowStore.getState();
    const nodeBounds = buildAvoidanceNodeBounds(state.nodes);
    const nodeBoundsById = new Map(nodeBounds.map((bounds) => [bounds.id, bounds]));
    const parallelEdgeInfoById = buildParallelEdgeInfo(state.edges);
    const cache = new AvoidanceRouteCache();
    const requests: AvoidanceRouteRequest[] = state.edges.map((edge) => {
      const sourceBounds = nodeBoundsById.get(edge.source);
      const targetBounds = nodeBoundsById.get(edge.target);
      const sourceXY = {
        x: sourceBounds?.maxX ?? 0,
        y: sourceBounds ? (sourceBounds.minY + sourceBounds.maxY) / 2 : 0,
      };
      const targetXY = {
        x: targetBounds?.minX ?? 100,
        y: targetBounds ? (targetBounds.minY + targetBounds.maxY) / 2 : 0,
      };
      return {
        edgeId: edge.id,
        sourceId: edge.source,
        targetId: edge.target,
        sourceXY,
        targetXY,
        sourcePosition: "right",
        targetPosition: "left",
        parallelEdgeInfo: parallelEdgeInfoById.get(edge.id),
        config: {
          maxRecursionDepth: 3,
          avoidMargin: 20,
          cornerRadius: 8,
          directLineMaxDistance: 200,
          edgeOffsetStep: 15,
        },
      };
    });

    let algorithmExecutions = 0;
    const calculate = (request: AvoidanceRouteRequest) => {
      algorithmExecutions += 1;
      return {
        path: `M ${request.sourceXY.x} ${request.sourceXY.y} L ${request.targetXY.x} ${request.targetXY.y}`,
        labelX: (request.sourceXY.x + request.targetXY.x) / 2,
        labelY: (request.sourceXY.y + request.targetXY.y) / 2,
        points: [request.sourceXY, request.targetXY],
        blockingNodeIds: [],
      };
    };

    for (const request of requests) {
      cache.get(request, nodeBoundsById, new Map(), () => calculate(request));
    }
    for (const request of requests) {
      cache.get(request, nodeBoundsById, new Map(), () => calculate(request));
    }

    const stats = cache.getStats();
    expect(algorithmExecutions).toBe(requests.length);
    expect(stats.hits).toBe(requests.length);
    expect(stats.misses).toBe(requests.length);
    console.info(
      `[PERF-005B] large cache reuse: requests=${requests.length}x2, algorithm=${algorithmExecutions}, hits=${stats.hits}, misses=${stats.misses}, invalidations=${stats.invalidations}`,
    );
  });

  it("measures PERF-013 indexed snap queries", async () => {
    const datasetPath = resolve(
      process.cwd(),
      "../dev/performance/editor/datasets/performance-large-300.json",
    );
    const pipelineText = await readFile(datasetPath, "utf8");
    expect(await pipelineToFlow({ pString: pipelineText })).toBe(true);

    const state = useFlowStore.getState();
    const draggedNode = state.nodes.find(
      (node) => node.data.label === "Perf_Node_0050",
    );
    expect(draggedNode).toBeDefined();
    const measured = { width: 200, height: 100 };
    const candidates = state.nodes
      .filter(
        (node) =>
          node.id !== draggedNode!.id && node.type !== NodeTypeEnum.Group,
      )
      .map((node) => ({
        id: node.id,
        position: getNodeAbsolutePosition(node, state.nodeById),
        measured,
      }));
    const index = buildSnapAlignmentIndex(candidates);
    const dragPositions = createDragPositions(
      getNodeAbsolutePosition(draggedNode!, state.nodeById),
    );
    let inspectedCoordinates = 0;
    let maxInspectedCoordinates = 0;

    for (const position of dragPositions) {
      const result = findSnapAlignmentWithIndex(
        { id: draggedNode!.id, position, measured },
        index,
      );
      inspectedCoordinates += result.inspectedCoordinates;
      maxInspectedCoordinates = Math.max(
        maxInspectedCoordinates,
        result.inspectedCoordinates,
      );
    }

    const legacyCandidateVisits = candidates.length * dragPositions.length;
    const legacyPointComparisons = legacyCandidateVisits * 18;
    expect(maxInspectedCoordinates).toBeLessThanOrEqual(12);
    expect(inspectedCoordinates).toBeLessThan(legacyCandidateVisits);
    console.info(
      `[PERF-013] 300-node/300-move snap: candidate-visits=${legacyCandidateVisits}->0, point-comparisons=${legacyPointComparisons}->${inspectedCoordinates}, max-query-coordinates=${maxInspectedCoordinates}`,
    );
  });

  it("measures PERF-014 incremental programmatic selection", async () => {
    const datasetPath = resolve(
      process.cwd(),
      "../dev/performance/editor/datasets/performance-large-300.json",
    );
    const pipelineText = await readFile(datasetPath, "utf8");
    expect(await pipelineToFlow({ pString: pipelineText })).toBe(true);

    const state = useFlowStore.getState();
    const previousNodeId = state.nodes[0].id;
    const targetNodeId = state.nodes[1].id;
    const previousEdgeId = state.edges[0].id;
    const changes = buildIncrementalSelectionChanges({
      selectedNodeIds: new Set([previousNodeId]),
      selectedEdgeIds: new Set([previousEdgeId]),
      targetNodeIds: new Set([targetNodeId]),
      targetEdgeIds: new Set(),
    });

    expect(changes.nodeChanges).toHaveLength(2);
    expect(changes.edgeChanges).toHaveLength(1);
    expect(changes.nodeChanges.length).toBeLessThan(state.nodes.length);
    console.info(
      `[PERF-014] 300-node single navigation: node-select-changes=${state.nodes.length}->${changes.nodeChanges.length}, edge-clear-changes=${changes.edgeChanges.length}`,
    );
  });
});
