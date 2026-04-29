import { describe, expect, it } from "vitest";
import {
  createDebugResolverEdgeIndex,
  findDebugResolverEdge,
  selectDebugNodeExecutionRecords,
} from "./nodeExecutionSelector";
import { reduceDebugTrace } from "./traceReducer";
import type { DebugEvent, DebugEventKind, DebugEventPhase } from "./types";

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
