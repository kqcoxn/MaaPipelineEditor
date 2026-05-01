import { describe, expect, it } from "vitest";
import {
  getDebugReplayRecordState,
  getDebugNodeReplayControl,
  selectDebugBatchRecognitionNodeSummaries,
  selectDebugNodeExecutionOverlay,
  selectDebugNodeExecutionOverlayFromEdges,
} from "./nodeExecutionAnalysis";
import {
  createDebugResolverEdgeIndex,
  findDebugResolverEdge,
  groupDebugNodeExecutionRecords,
  selectDebugNodeExecutionRecords,
  type ResolverEdge,
} from "./nodeExecutionSelector";
import { reduceDebugTrace } from "./traceReducer";
import {
  DEBUG_TASKER_BOOTSTRAP_LABEL,
  DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
  type DebugArtifactPayload,
  type DebugBatchRecognitionResult,
  type DebugEvent,
  type DebugEdgeReason,
  type DebugEventKind,
  type DebugEventPhase,
  type DebugPerformanceSummary,
} from "./types";

describe("selectDebugNodeExecutionRecords", () => {
  it("returns execution records in firstSeq order with resolver metadata", () => {
    const summary = reduceDebugTrace({
      events: [
        event(10, "node", "starting", node("node-b", "B")),
        event(11, "node", "succeeded", node("node-b", "B")),
        event(1, "node", "starting", node("node-a", "A")),
        event(2, "next-list", "succeeded", node("node-a", "A"), {
          next: [{ name: "B", jumpBack: false, anchor: true }],
        }),
        event(3, "node", "succeeded", node("node-a", "A")),
      ],
    });

    const records = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
    );

    expect(records.map((record) => record.runtimeName)).toEqual(["A", "B"]);
    expect(records[0]).toMatchObject({
      nodeId: "node-a",
      fileId: "main.json",
      label: "Alpha",
      sourcePath: "project/main.json",
      occurrence: 1,
      nextListCount: 1,
    });
  });

  it("filters by status and node id without mixing artifact refs", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", node("node-a", "A")),
        event(2, "recognition", "succeeded", node("node-a", "A"), undefined, {
          detailRef: "a-first-detail",
        }),
        event(3, "node", "succeeded", node("node-a", "A")),
        event(4, "node", "starting", node("node-a", "A")),
        event(5, "action", "failed", node("node-a", "A"), undefined, {
          detailRef: "a-second-detail",
        }),
        event(6, "node", "failed", node("node-a", "A")),
      ],
    });

    const failedRecords = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { nodeId: "node-a", status: "failed" },
    );

    expect(failedRecords).toHaveLength(1);
    expect(failedRecords[0].occurrence).toBe(2);
    expect(failedRecords[0].detailRefs).toEqual(["a-second-detail"]);
  });

  it("builds stable recognition and action attempts without mixing refs", () => {
    const summary = reduceDebugTrace({
      events: [
        event(0, "node", "starting", node("node-a", "A")),
        event(1, "recognition", "starting", node("node-a", "A"), {
          id: "reco-1",
        }),
        event(
          2,
          "recognition",
          "succeeded",
          node("node-a", "A"),
          {
            id: "reco-1",
            hit: true,
            algorithm: "TemplateMatch",
            box: [1, 2, 3, 4],
          },
          { detailRef: "reco-1-detail", screenshotRef: "reco-1-shot" },
        ),
        event(
          3,
          "recognition",
          "failed",
          node("node-a", "A"),
          { hit: false },
          { detailRef: "reco-seq-detail" },
        ),
        event(4, "action", "starting", node("node-a", "A"), {
          id: "act-1",
          action: "Click",
        }),
        event(
          5,
          "action",
          "succeeded",
          node("node-a", "A"),
          { id: "act-1", action: "Click", success: true },
          { detailRef: "act-1-detail" },
        ),
        event(6, "node", "succeeded", node("node-a", "A")),
      ],
    });

    const [record] = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
    );

    expect(record.recognitionAttempts).toHaveLength(2);
    expect(record.actionAttempts).toHaveLength(1);
    expect(record.recognitionAttempts[0]).toMatchObject({
      dataId: "reco-1",
      firstSeq: 1,
      lastSeq: 2,
      detailRefs: ["reco-1-detail"],
      screenshotRefs: ["reco-1-shot"],
      hit: true,
      algorithm: "TemplateMatch",
    });
    expect(record.recognitionAttempts[1]).toMatchObject({
      firstSeq: 3,
      lastSeq: 3,
      detailRefs: ["reco-seq-detail"],
      screenshotRefs: [],
      hit: false,
    });
    expect(record.recognitionAttempts[1].id).toContain(
      ":recognition:3-3:seq:3",
    );
    expect(record.actionAttempts[0]).toMatchObject({
      dataId: "act-1",
      firstSeq: 4,
      lastSeq: 5,
      detailRefs: ["act-1-detail"],
      screenshotRefs: [],
      action: "Click",
      success: true,
    });
  });

  it("keeps unmapped records visible and marks them as runtime-only", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", { runtimeName: "RuntimeOnly" }),
        event(2, "node", "succeeded", { runtimeName: "RuntimeOnly" }),
      ],
    });

    const records = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
    );

    expect(records[0]).toMatchObject({
      runtimeName: "RuntimeOnly",
      nodeId: undefined,
      unmapped: true,
    });
  });

  it("shows the initial bootstrap as a synthetic Tasker record", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "task", "starting", undefined, { entry: "A" }),
        event(2, "node", "starting", taskerBootstrapNode()),
        event(3, "next-list", "succeeded", taskerBootstrapNode(), {
          next: [{ name: "A", jumpBack: false, anchor: true }],
        }),
        event(4, "recognition", "succeeded", node("node-a", "A"), {
          parentNode: DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
        }),
        event(5, "node", "starting", node("node-a", "A")),
        event(6, "node", "succeeded", node("node-a", "A")),
      ],
    });

    const records = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
    );

    expect(records.map((record) => record.label)).toEqual([
      DEBUG_TASKER_BOOTSTRAP_LABEL,
      "Alpha",
    ]);
    expect(records[0]).toMatchObject({
      runtimeName: DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
      label: DEBUG_TASKER_BOOTSTRAP_LABEL,
      syntheticKind: "tasker-bootstrap",
      nodeId: undefined,
      fileId: undefined,
      unmapped: false,
      nextListCount: 1,
      recognitionCount: 1,
    });
    expect(records[0].recognitionEvents[0].node?.runtimeName).toBe("A");
    expect(records[1]).toMatchObject({
      runtimeName: "A",
      nodeId: "node-a",
      firstSeq: 5,
    });

    const overlay = selectDebugNodeExecutionOverlayFromEdges(
      records,
      records[0],
      [
        {
          edgeId: "edge-a-b",
          fromRuntimeName: "A",
          toRuntimeName: "B",
          reason: "next",
        },
      ],
    );
    expect(overlay.selectedExecutionNodeId).toBeUndefined();
    expect(overlay.executionPathNodeIds).toEqual([]);
    expect(overlay.executionCandidateEdgeIds).toEqual([]);
  });

  it("defensively labels the first task bootstrap record as Tasker", () => {
    const summary = reduceDebugTrace({
      events: [
        event(0, "session", "starting", undefined, { mode: "run-from-node" }),
        event(1, "node", "starting", { runtimeName: "Task" }),
        event(2, "next-list", "succeeded", { runtimeName: "Task" }, {
          next: [{ name: "A", jumpBack: false, anchor: false }],
        }),
        event(3, "recognition", "succeeded", node("node-a", "A"), {
          parentNode: "Task",
          hit: true,
        }),
        event(4, "node", "starting", node("node-a", "A")),
        event(5, "node", "succeeded", node("node-a", "A")),
      ],
    });

    const records = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
    );

    expect(records[0]).toMatchObject({
      runtimeName: DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
      label: DEBUG_TASKER_BOOTSTRAP_LABEL,
      syntheticKind: "tasker-bootstrap",
      nodeId: undefined,
      fileId: undefined,
      unmapped: false,
    });
    expect(records[0].events[0].node).toMatchObject({
      runtimeName: DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
      label: DEBUG_TASKER_BOOTSTRAP_LABEL,
      syntheticKind: "tasker-bootstrap",
    });
    expect(records[0].recognitionEvents[0].data?.parentNode).toBe(
      DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
    );
  });

  it("labels the first task record as Tasker even when it was mapped to a real node", () => {
    const summary = reduceDebugTrace({
      events: [
        event(0, "session", "starting", undefined, { mode: "run-from-node" }),
        event(1, "node", "starting", node("node-a", "A")),
        event(2, "next-list", "succeeded", node("node-a", "A"), {
          next: [{ name: "B", jumpBack: false, anchor: false }],
        }),
        event(3, "recognition", "succeeded", node("node-b", "B"), {
          parentNode: "A",
          hit: true,
        }),
        event(4, "node", "starting", node("node-a", "A")),
        event(5, "node", "succeeded", node("node-a", "A")),
        event(6, "node", "starting", node("node-b", "B")),
        event(7, "node", "succeeded", node("node-b", "B")),
      ],
    });

    const records = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
    );

    expect(records.map((record) => record.label)).toEqual([
      DEBUG_TASKER_BOOTSTRAP_LABEL,
      "Alpha",
      "Beta",
    ]);
    expect(records[0]).toMatchObject({
      runtimeName: DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
      label: DEBUG_TASKER_BOOTSTRAP_LABEL,
      syntheticKind: "tasker-bootstrap",
      nodeId: undefined,
      fileId: undefined,
      unmapped: false,
      nextListCount: 1,
    });
    expect(records[0].events[0].node).toMatchObject({
      runtimeName: DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
      label: DEBUG_TASKER_BOOTSTRAP_LABEL,
      syntheticKind: "tasker-bootstrap",
    });
    expect(records[0].recognitionEvents[0].data?.parentNode).toBe(
      DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
    );
    expect(records[1]).toMatchObject({
      runtimeName: "A",
      nodeId: "node-a",
      firstSeq: 4,
    });
  });

  it("does not move the entry node action into Tasker when splitting a mapped bootstrap segment", () => {
    const summary = reduceDebugTrace({
      events: [
        event(0, "session", "starting", undefined, { mode: "run-from-node" }),
        event(1, "node", "starting", node("node-a", "A")),
        event(2, "next-list", "succeeded", node("node-a", "A"), {
          next: [{ name: "A", jumpBack: false, anchor: true }],
        }),
        event(3, "recognition", "succeeded", node("node-a", "A"), {
          parentNode: "A",
          hit: true,
        }),
        event(4, "action", "succeeded", node("node-a", "A")),
        event(5, "node", "succeeded", node("node-a", "A")),
      ],
    });

    const nextModeRecords = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
      { attributionMode: "next" },
    );
    const nodeModeRecords = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
      { attributionMode: "node" },
    );

    expect(nextModeRecords.map((record) => record.runtimeName)).toEqual([
      DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
      "A",
    ]);
    expect(nextModeRecords[0]).toMatchObject({
      syntheticKind: "tasker-bootstrap",
      recognitionCount: 1,
      actionCount: 0,
    });
    expect(nextModeRecords[1]).toMatchObject({
      runtimeName: "A",
      recognitionCount: 0,
      actionCount: 1,
      firstSeq: 4,
      lastSeq: 5,
    });

    expect(nodeModeRecords.map((record) => record.runtimeName)).toEqual(["A"]);
    expect(nodeModeRecords[0]).toMatchObject({
      recognitionCount: 1,
      actionCount: 1,
      firstSeq: 1,
      lastSeq: 5,
    });
  });

  it("keeps bootstrap recognition on Tasker in next mode and attaches recognition-action pairs to the target in node mode", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "task", "starting", undefined, { entry: "A" }),
        event(2, "node", "starting", taskerBootstrapNode()),
        event(3, "next-list", "succeeded", taskerBootstrapNode(), {
          next: [{ name: "A", jumpBack: false, anchor: true }],
        }),
        event(4, "recognition", "succeeded", node("node-a", "A"), {
          parentNode: DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
          hit: true,
        }),
        event(5, "node", "starting", node("node-a", "A")),
        event(6, "action", "succeeded", node("node-a", "A")),
        event(7, "node", "succeeded", node("node-a", "A")),
      ],
    });

    const nextModeRecords = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
      {
        attributionMode: "next",
        resolverEdges,
      },
    );
    const nodeModeRecords = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
      {
        attributionMode: "node",
        resolverEdges,
      },
    );

    expect(nextModeRecords.map((record) => record.runtimeName)).toEqual([
      DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
      "A",
    ]);
    expect(nextModeRecords[0]).toMatchObject({
      attributionMode: "next",
      recognitionCount: 1,
      nextCandidateSummary: {
        candidateCount: 1,
        hitCount: 1,
        edgeCount: 0,
      },
    });

    expect(nodeModeRecords.map((record) => record.runtimeName)).toEqual(["A"]);
    expect(nodeModeRecords[0]).toMatchObject({
      attributionMode: "node",
      runtimeName: "A",
      sourceNextOwnerRuntimeName: DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
      sourceNextOwnerLabel: DEBUG_TASKER_BOOTSTRAP_LABEL,
      recognitionCount: 1,
      actionCount: 1,
      firstSeq: 4,
      lastSeq: 7,
    });
    expect(nodeModeRecords[0].recognitionAttempts[0]).toMatchObject({
      firstSeq: 4,
      sourceNextOwnerRuntimeName: DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
      sourceNextOwnerLabel: DEBUG_TASKER_BOOTSTRAP_LABEL,
      hit: true,
    });
  });

  it("merges a non-terminal node action segment with its following next-list continuation", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", node("node-b", "B")),
        event(2, "next-list", "succeeded", node("node-b", "B"), {
          next: [{ name: "A", jumpBack: false, anchor: true }],
        }),
        event(3, "recognition", "succeeded", node("node-a", "A"), {
          parentNode: "B",
          hit: true,
        }),
        event(4, "node", "succeeded", node("node-b", "B")),
        event(5, "node", "starting", node("node-a", "A")),
        event(6, "action", "succeeded", node("node-a", "A")),
        event(7, "node", "succeeded", node("node-a", "A")),
        event(8, "node", "starting", node("node-a", "A")),
        event(9, "next-list", "succeeded", node("node-a", "A"), {
          next: [{ name: "C", jumpBack: false, anchor: true }],
        }),
        event(10, "recognition", "succeeded", node("node-c", "C"), {
          parentNode: "A",
          hit: true,
        }),
        event(11, "node", "succeeded", node("node-a", "A")),
      ],
    });

    const nextModeRecords = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
      { attributionMode: "next", resolverEdges },
    );
    const nodeModeRecords = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
      { attributionMode: "node", resolverEdges },
    );
    const nextModeARecords = nextModeRecords.filter(
      (record) => record.runtimeName === "A",
    );
    const nodeModeARecords = nodeModeRecords.filter(
      (record) => record.runtimeName === "A",
    );

    expect(nextModeARecords).toHaveLength(1);
    expect(nextModeARecords[0]).toMatchObject({
      attributionMode: "next",
      actionCount: 1,
      recognitionCount: 1,
      nextListCount: 1,
      firstSeq: 5,
      lastSeq: 11,
      nextCandidateSummary: {
        candidateCount: 1,
        hitCount: 1,
      },
    });
    expect(nextModeARecords[0].nextCandidateSummary.candidates[0]).toMatchObject({
      runtimeName: "C",
      recognitionSeqs: [10],
    });

    expect(nodeModeARecords).toHaveLength(1);
    expect(nodeModeARecords[0]).toMatchObject({
      attributionMode: "node",
      actionCount: 1,
      recognitionCount: 1,
      nextListCount: 1,
      sourceNextOwnerRuntimeName: "B",
      firstSeq: 3,
      lastSeq: 11,
    });
    expect(nodeModeARecords[0].recognitionAttempts[0]).toMatchObject({
      sourceNextOwnerRuntimeName: "B",
      hit: true,
    });
  });

  it("treats mixed successful and failed attempts as succeeded with a failure hint", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", node("node-a", "A")),
        event(2, "recognition", "succeeded", node("node-a", "A"), {
          id: "hit",
          hit: true,
        }),
        event(3, "recognition", "failed", node("node-a", "A"), {
          id: "miss",
          hit: false,
        }),
        event(4, "node", "failed", node("node-a", "A")),
      ],
    });

    const [record] = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
    );
    const failedRecords = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "failed" },
    );

    expect(record).toMatchObject({
      status: "succeeded",
      hasFailure: true,
    });
    expect(failedRecords).toHaveLength(0);
  });

  it("treats all-miss attempts as failed without the mixed failure hint", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", node("node-a", "A")),
        event(2, "recognition", "failed", node("node-a", "A"), {
          id: "miss",
          hit: false,
        }),
        event(3, "node", "failed", node("node-a", "A")),
      ],
    });

    const [record] = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
    );

    expect(record).toMatchObject({
      status: "failed",
      hasFailure: false,
    });
  });

  it("summarizes next candidates in next mode and assigns candidate recognitions to target nodes in node mode", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", node("node-b", "B")),
        event(2, "next-list", "succeeded", node("node-b", "B"), {
          next: [
            { name: "C", jumpBack: false, anchor: true },
            { name: "D", jumpBack: true, anchor: false },
          ],
        }),
        event(3, "recognition", "succeeded", node("node-c", "C"), {
          parentNode: "B",
          hit: true,
        }),
        event(4, "recognition", "failed", { runtimeName: "D" }, {
          parentNode: "B",
          hit: false,
        }),
        event(5, "node", "succeeded", node("node-b", "B")),
        event(6, "node", "starting", node("node-c", "C")),
        event(7, "action", "succeeded", node("node-c", "C")),
        event(8, "node", "succeeded", node("node-c", "C")),
      ],
    });

    const nextModeRecords = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
      {
        attributionMode: "next",
        resolverEdges,
      },
    );
    const nodeModeRecords = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
      {
        attributionMode: "node",
        resolverEdges,
      },
    );
    const nextModeB = nextModeRecords.find(
      (record) => record.runtimeName === "B",
    );
    const nodeModeC = nodeModeRecords.find(
      (record) => record.runtimeName === "C",
    );
    const nodeModeD = nodeModeRecords.find(
      (record) => record.runtimeName === "D",
    );

    expect(nextModeB).toMatchObject({
      attributionMode: "next",
      recognitionCount: 2,
      nextCandidateSummary: {
        candidateCount: 2,
        hitCount: 1,
        missCount: 1,
        edgeCount: 1,
        jumpBackCount: 1,
        anchorCount: 1,
      },
    });
    expect(nextModeB?.nextCandidateSummary.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          runtimeName: "C",
          label: "Gamma",
          hit: true,
          edgeId: "edge-b-c",
          recognitionSeqs: [3],
        }),
        expect.objectContaining({
          runtimeName: "D",
          label: "D",
          hit: false,
          unmappedEdge: true,
          recognitionSeqs: [4],
        }),
      ]),
    );

    expect(nodeModeRecords.some((record) => record.syntheticKind)).toBe(false);
    expect(nodeModeC).toMatchObject({
      attributionMode: "node",
      runtimeName: "C",
      sourceNextOwnerRuntimeName: "B",
      sourceNextOwnerLabel: "Beta",
      recognitionCount: 1,
      actionCount: 1,
      firstSeq: 3,
      lastSeq: 8,
    });
    expect(nodeModeD).toMatchObject({
      attributionMode: "node",
      runtimeName: "D",
      nodeId: undefined,
      unmapped: true,
      sourceNextOwnerRuntimeName: "B",
      recognitionCount: 1,
      actionCount: 0,
      status: "failed",
    });
    expect(nodeModeD?.recognitionAttempts[0]).toMatchObject({
      firstSeq: 4,
      sourceNextOwnerRuntimeName: "B",
      sourceNextOwnerLabel: "Beta",
      hit: false,
    });
    expect(nodeModeD?.actionAttempts).toEqual([]);
  });

  it("keeps runtime-only records visible in node attribution mode", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", { runtimeName: "RuntimeOnly" }),
        event(2, "node", "succeeded", { runtimeName: "RuntimeOnly" }),
      ],
    });

    const records = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
      { attributionMode: "node" },
    );

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      attributionMode: "node",
      runtimeName: "RuntimeOnly",
      nodeId: undefined,
      unmapped: true,
    });
  });

  it("indexes resolver edges for next-list mapping", () => {
    const edgeIndex = createDebugResolverEdgeIndex([
      {
        edgeId: "edge-a-b",
        fromRuntimeName: "A",
        toRuntimeName: "B",
        reason: "anchor",
      },
    ]);

    expect(findDebugResolverEdge(edgeIndex, "A", "B")?.edgeId).toBe("edge-a-b");
    expect(findDebugResolverEdge(edgeIndex, "B", "A")).toBeUndefined();
  });

  it("filters by run, event kind, artifact and failure marker", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", node("node-a", "A")),
        event(2, "recognition", "succeeded", node("node-a", "A")),
        event(3, "node", "succeeded", node("node-a", "A")),
        withRun("run-2", event(4, "node", "starting", node("node-b", "B"))),
        withRun(
          "run-2",
          event(5, "action", "failed", node("node-b", "B"), undefined, {
            detailRef: "action-detail",
          }),
        ),
        withRun("run-2", event(6, "node", "failed", node("node-b", "B"))),
      ],
    });

    const records = selectDebugNodeExecutionRecords(summary, resolverNodes, {
      status: "all",
      runId: "run-2",
      eventKind: "action",
      artifact: "with-artifact",
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      runtimeName: "B",
      status: "failed",
      hasArtifact: true,
      hasFailure: false,
    });
  });

  it("sorts by failure, slow node and latest without changing execution default", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", node("node-a", "A")),
        event(2, "node", "failed", node("node-a", "A")),
        event(3, "node", "starting", node("node-b", "B")),
        event(4, "node", "succeeded", node("node-b", "B")),
        event(5, "node", "starting", node("node-c", "C")),
        event(6, "node", "succeeded", node("node-c", "C")),
      ],
    });
    const performanceSummary = performance({
      nodes: [
        performanceNode("node-a", "A", 1, 2, 10),
        performanceNode("node-b", "B", 3, 4, 2000),
        performanceNode("node-c", "C", 5, 6, 30),
      ],
      slowNodes: [performanceNode("node-b", "B", 3, 4, 2000)],
    });

    const execution = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
      { performanceSummary },
    );
    const failureFirst = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all", sortMode: "failure-first" },
      { performanceSummary },
    );
    const slowFirst = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all", sortMode: "slow-first" },
      { performanceSummary },
    );
    const latest = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all", sortMode: "latest" },
      { performanceSummary },
    );

    expect(execution.map((record) => record.runtimeName)).toEqual([
      "A",
      "B",
      "C",
    ]);
    expect(failureFirst[0].runtimeName).toBe("A");
    expect(slowFirst[0]).toMatchObject({
      runtimeName: "B",
      slow: true,
      durationMs: 2000,
      durationSource: "performance",
    });
    expect(latest[0].runtimeName).toBe("C");
  });

  it("groups repeated nodes without dropping occurrences", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", node("node-a", "A")),
        event(2, "node", "succeeded", node("node-a", "A")),
        event(3, "node", "starting", node("node-b", "B")),
        event(4, "node", "succeeded", node("node-b", "B")),
        event(5, "node", "starting", node("node-a", "A")),
        event(6, "node", "succeeded", node("node-a", "A")),
      ],
    });

    const groups = groupDebugNodeExecutionRecords(
      selectDebugNodeExecutionRecords(summary, resolverNodes, {
        status: "all",
      }),
    );
    const repeatedGroup = groups.find((group) => group.nodeId === "node-a");

    expect(repeatedGroup?.occurrenceCount).toBe(2);
    expect(repeatedGroup?.records.map((record) => record.occurrence)).toEqual([
      1,
      2,
    ]);
  });

  it("estimates duration from trace timestamps when performance is absent", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", node("node-a", "A")),
        event(4, "node", "succeeded", node("node-a", "A")),
      ],
    });

    const records = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
    );

    expect(records[0]).toMatchObject({
      durationMs: 3000,
      durationSource: "trace",
    });
  });
});

describe("node execution v2 analysis", () => {
  it("marks replay cursor position against the selected record", () => {
    const summary = reduceDebugTrace({
      events: [
        event(10, "node", "starting", node("node-a", "A")),
        event(12, "node", "succeeded", node("node-a", "A")),
      ],
    });
    const [record] = selectDebugNodeExecutionRecords(summary, resolverNodes, {
      status: "all",
    });

    expect(
      getDebugNodeReplayControl(record, replayStatus(9)).recordState,
    ).toBe("not-reached");
    expect(
      getDebugNodeReplayControl(record, replayStatus(11)).recordState,
    ).toBe("current");
    expect(
      getDebugNodeReplayControl(record, replayStatus(13)).recordState,
    ).toBe("passed");
  });

  it("builds node execution overlay without dropping repeated or unmapped records", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", node("node-a", "A")),
        edgeEvent(2, "edge-a-b", "A", "B", "next"),
        event(3, "node", "succeeded", node("node-a", "A")),
        event(4, "node", "starting", node("node-b", "B")),
        edgeEvent(5, "edge-b-c", "B", "C", "candidate"),
        event(6, "node", "failed", node("node-b", "B")),
        withRun("run-2", event(7, "node", "starting", node("node-a", "A"))),
        event(8, "node", "starting", { runtimeName: "RuntimeOnly" }),
      ],
    });
    const records = selectDebugNodeExecutionRecords(summary, resolverNodes, {
      status: "all",
    });
    const selected = records.find((record) => record.nodeId === "node-b");

    const overlay = selectDebugNodeExecutionOverlay(records, selected);

    expect(overlay.executionPathNodeIds).toEqual(["node-a", "node-b"]);
    expect(overlay.executionPathEdgeIds).toEqual(["edge-a-b"]);
    expect(overlay.executionCandidateEdgeIds).toEqual(["edge-b-c"]);
    expect(overlay.highlightedFailureNodeIds).toEqual(["node-b"]);
  });

  it("marks replay state for other runs and node-scoped cursors as not reached", () => {
    const summary = reduceDebugTrace({
      events: [
        event(10, "node", "starting", node("node-a", "A")),
        event(12, "node", "succeeded", node("node-a", "A")),
        withRun("run-2", event(13, "node", "starting", node("node-b", "B"))),
      ],
    });
    const records = selectDebugNodeExecutionRecords(summary, resolverNodes, {
      status: "all",
    });
    const recordA = records.find((record) => record.nodeId === "node-a");
    const recordB = records.find((record) => record.nodeId === "node-b");

    expect(
      recordA && getDebugReplayRecordState(recordA, replayStatus(11)),
    ).toBe("current");
    expect(
      recordB && getDebugReplayRecordState(recordB, replayStatus(20)),
    ).toBe("not-reached");
    expect(
      recordA &&
        getDebugReplayRecordState(recordA, {
          ...replayStatus(11),
          nodeId: "node-b",
        }),
    ).toBe("not-reached");
  });

  it("derives candidate edge highlights from next-list resolver mapping", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", node("node-a", "A")),
        event(2, "next-list", "succeeded", node("node-a", "A"), {
          next: [{ name: "B", jumpBack: false, anchor: true }],
        }),
        event(3, "node", "succeeded", node("node-a", "A")),
        event(4, "node", "starting", node("node-b", "B")),
        event(5, "node", "succeeded", node("node-b", "B")),
      ],
    });
    const records = selectDebugNodeExecutionRecords(summary, resolverNodes, {
      status: "all",
    });
    const overlay = selectDebugNodeExecutionOverlayFromEdges(
      records,
      records[1],
      [
        {
          edgeId: "edge-a-b",
          fromRuntimeName: "A",
          toRuntimeName: "B",
          reason: "anchor",
        },
      ],
    );

    expect(overlay.executionPathEdgeIds).toEqual([]);
    expect(overlay.executionCandidateEdgeIds).toEqual(["edge-a-b"]);
  });

  it("does not infer executed edges from static resolver adjacency alone", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", node("node-a", "A")),
        event(2, "node", "succeeded", node("node-a", "A")),
        event(3, "node", "starting", node("node-b", "B")),
        event(4, "node", "succeeded", node("node-b", "B")),
      ],
    });
    const records = selectDebugNodeExecutionRecords(summary, resolverNodes, {
      status: "all",
    });
    const overlay = selectDebugNodeExecutionOverlayFromEdges(
      records,
      records[1],
      [
        {
          edgeId: "edge-a-b",
          fromRuntimeName: "A",
          toRuntimeName: "B",
          reason: "next",
        },
      ],
    );

    expect(overlay.executionPathEdgeIds).toEqual([]);
    expect(overlay.executionCandidateEdgeIds).toEqual([]);
  });

  it("aggregates batch recognition summary artifacts by target node", () => {
    const summaries = selectDebugBatchRecognitionNodeSummaries({
      "batch-summary": {
        ref: {
          id: "batch-summary",
          sessionId: "session-1",
          type: "batch-recognition-summary",
          mime: "application/json",
          createdAt: "2026-04-29T00:00:00.000Z",
        },
        status: "ready",
        payload: {
          ref: {
            id: "batch-summary",
            sessionId: "session-1",
            type: "batch-recognition-summary",
            mime: "application/json",
            createdAt: "2026-04-29T00:00:00.000Z",
          },
          data: batchResult(),
        } satisfies DebugArtifactPayload,
      },
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      batchId: "batch-1",
      nodeId: "node-a",
      total: 3,
      succeeded: 1,
      failed: 1,
      detailRefs: ["detail-1", "detail-2"],
      screenshotRefs: ["shot-1"],
    });
  });

});

const resolverNodes = [
  {
    fileId: "main.json",
    nodeId: "node-a",
    runtimeName: "A",
    displayName: "Alpha",
    sourcePath: "project/main.json",
  },
  {
    fileId: "main.json",
    nodeId: "node-b",
    runtimeName: "B",
    displayName: "Beta",
    sourcePath: "project/main.json",
  },
  {
    fileId: "main.json",
    nodeId: "node-c",
    runtimeName: "C",
    displayName: "Gamma",
    sourcePath: "project/main.json",
  },
];

const resolverEdges: ResolverEdge[] = [
  {
    edgeId: "edge-b-c",
    fromRuntimeName: "B",
    toRuntimeName: "C",
    reason: "anchor",
  },
];

function event(
  seq: number,
  kind: DebugEventKind,
  phase?: DebugEventPhase,
  nodeValue?: DebugEvent["node"],
  data?: Record<string, unknown>,
  refs?: { detailRef?: string; screenshotRef?: string },
): DebugEvent {
  return {
    sessionId: "session-1",
    runId: "run-1",
    seq,
    timestamp: `2026-04-29T00:00:${String(seq).padStart(2, "0")}.000Z`,
    source: "maafw",
    kind,
    phase,
    node: nodeValue,
    data,
    detailRef: refs?.detailRef,
    screenshotRef: refs?.screenshotRef,
  };
}

function node(nodeId: string, runtimeName: string): DebugEvent["node"] {
  return {
    fileId: "main.json",
    nodeId,
    runtimeName,
    label: runtimeName,
  };
}

function taskerBootstrapNode(): DebugEvent["node"] {
  return {
    runtimeName: DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
    label: DEBUG_TASKER_BOOTSTRAP_LABEL,
    syntheticKind: "tasker-bootstrap",
  };
}

function withRun(runId: string, value: DebugEvent): DebugEvent {
  return { ...value, runId };
}

function edgeEvent(
  seq: number,
  edgeId: string,
  fromRuntimeName: string,
  toRuntimeName: string,
  reason: DebugEdgeReason,
): DebugEvent {
  return {
    ...event(seq, "next-list", "succeeded", node("node-a", fromRuntimeName)),
    edge: {
      edgeId,
      fromRuntimeName,
      toRuntimeName,
      reason,
    },
  };
}

function replayStatus(cursorSeq: number) {
  return {
    sessionId: "session-1",
    runId: "run-1",
    active: true,
    playing: false,
    cursorSeq,
  };
}

function batchResult(): DebugBatchRecognitionResult {
  return {
    sessionId: "session-1",
    batchId: "batch-1",
    target: {
      fileId: "main.json",
      nodeId: "node-a",
      runtimeName: "A",
    },
    status: "failed",
    startedAt: "2026-04-29T00:00:00.000Z",
    completedAt: "2026-04-29T00:00:03.000Z",
    total: 3,
    completed: 2,
    succeeded: 1,
    failed: 1,
    averageDurationMs: 1500,
    results: [
      {
        index: 0,
        imageRelativePath: "a.png",
        status: "succeeded",
        hit: true,
        durationMs: 1000,
        detailRefs: ["detail-1"],
        screenshotRefs: ["shot-1"],
      },
      {
        index: 1,
        imageRelativePath: "b.png",
        status: "failed",
        durationMs: 2000,
        detailRefs: ["detail-2"],
        error: "failed",
      },
      {
        index: 2,
        imageRelativePath: "c.png",
        status: "running",
      },
    ],
  };
}

function performance(input: {
  nodes: DebugPerformanceSummary["nodes"];
  slowNodes: DebugPerformanceSummary["slowNodes"];
}): DebugPerformanceSummary {
  return {
    sessionId: "session-1",
    runId: "run-1",
    eventCount: 0,
    nodeCount: input.nodes.length,
    recognitionCount: 0,
    actionCount: 0,
    diagnosticCount: 0,
    artifactRefCount: 0,
    screenshotRefCount: 0,
    nodes: input.nodes,
    slowNodes: input.slowNodes,
    generatedAt: "2026-04-29T00:00:00.000Z",
  };
}

function performanceNode(
  nodeId: string,
  runtimeName: string,
  firstSeq: number,
  lastSeq: number,
  durationMs: number,
): DebugPerformanceSummary["nodes"][number] {
  return {
    fileId: "main.json",
    nodeId,
    runtimeName,
    firstSeq,
    lastSeq,
    durationMs,
    recognitionCount: 0,
    actionCount: 0,
    nextListCount: 0,
    waitFreezesCount: 0,
    detailRefCount: 0,
    screenshotRefCount: 0,
  };
}
