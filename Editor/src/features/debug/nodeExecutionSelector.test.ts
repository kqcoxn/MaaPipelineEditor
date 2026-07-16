import { describe, expect, it } from "vitest";
import {
  getDebugReplayRecordState,
  getDebugNodeReplayControl,
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
  type DebugEvent,
  type DebugEdgeReason,
  type DebugEventKind,
  type DebugEventPhase,
} from "./types";

describe("selectDebugNodeExecutionRecords", () => {
  it("returns execution records in firstSeq order with resolver metadata", () => {
    const summary = reduceDebugTrace({
      events: [
        event(10, "node", "starting", node("node-b", "B")),
        event(11, "node", "succeeded", node("node-b", "B")),
        event(20, "node", "starting", node("node-a", "A")),
        event(21, "node", "succeeded", node("node-a", "A")),
      ],
    });

    const records = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
    );

    expect(records.map((record) => record.runtimeName)).toEqual(["B", "A"]);
    expect(records[0]).toMatchObject({
      nodeId: "node-b",
      fileId: "main.json",
      sourcePath: "project/main.json",
      firstSeq: 10,
      lastSeq: 11,
      status: "succeeded",
      occurrence: 1,
    });
  });

  it("filters by status", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", node("node-a", "A")),
        event(2, "node", "failed", node("node-a", "A")),
        event(3, "node", "starting", node("node-b", "B")),
        event(4, "node", "succeeded", node("node-b", "B")),
      ],
    });

    const failed = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "failed" },
    );
    const succeeded = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "succeeded" },
    );

    expect(failed.map((record) => record.runtimeName)).toEqual(["A"]);
    expect(succeeded.map((record) => record.runtimeName)).toEqual(["B"]);
  });

  it("filters by nodeId", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", node("node-a", "A")),
        event(2, "node", "succeeded", node("node-a", "A")),
        event(3, "node", "starting", node("node-b", "B")),
        event(4, "node", "succeeded", node("node-b", "B")),
      ],
    });

    const records = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all", nodeId: "node-b" },
    );

    expect(records.map((record) => record.runtimeName)).toEqual(["B"]);
  });

  it("filters by event kind", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", node("node-a", "A")),
        event(2, "action", "succeeded", node("node-a", "A")),
        event(3, "node", "starting", node("node-b", "B")),
        event(4, "recognition", "succeeded", node("node-b", "B")),
      ],
    });

    const action = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all", eventKind: "action" },
    );
    const recognition = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all", eventKind: "recognition" },
    );

    expect(action.map((record) => record.runtimeName)).toEqual(["A"]);
    expect(recognition.map((record) => record.runtimeName)).toEqual(["B"]);
  });

  it("filters by artifact presence", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", node("node-a", "A")),
        event(2, "action", "succeeded", node("node-a", "A")),
        event(3, "node", "starting", node("node-b", "B")),
        event(
          4,
          "recognition",
          "succeeded",
          node("node-b", "B"),
          undefined,
          { detailRef: "ref-1" },
        ),
      ],
    });

    const withArtifact = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all", artifact: "with-artifact" },
    );
    const withoutArtifact = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all", artifact: "without-artifact" },
    );

    expect(withArtifact.map((record) => record.runtimeName)).toEqual(["B"]);
    expect(withoutArtifact.map((record) => record.runtimeName)).toEqual(["A"]);
  });

  it("sorts by failure and latest without changing execution default", () => {
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

    const execution = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
    );
    const failureFirst = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all", sortMode: "failure-first" },
    );
    const latest = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all", sortMode: "latest" },
    );

    expect(execution.map((record) => record.runtimeName)).toEqual([
      "A",
      "B",
      "C",
    ]);
    expect(failureFirst[0].runtimeName).toBe("A");
    expect(execution[1]).toMatchObject({
      runtimeName: "B",
      durationMs: 1000,
      durationSource: "trace",
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
