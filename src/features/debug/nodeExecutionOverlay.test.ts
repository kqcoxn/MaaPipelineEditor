import { describe, expect, it } from "vitest";
import {
  selectDebugNodeExecutionOverlayForSelection,
} from "./nodeExecutionAnalysis";
import {
  resolveAutoLoadAttemptArtifact,
  type DebugNodeExecutionAttempt,
} from "./nodeExecutionAttempts";
import {
  selectDebugNodeExecutionRecords,
  type ResolverEdge,
} from "./nodeExecutionSelector";
import { reduceDebugTrace } from "./traceReducer";
import {
  DEBUG_TASKER_BOOTSTRAP_LABEL,
  DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
  type DebugArtifactPayload,
  type DebugEvent,
  type DebugEventKind,
  type DebugEventPhase,
} from "./types";
import type { DebugArtifactEntry } from "../../stores/debugArtifactStore";

describe("nodeExecutionOverlay", () => {
  it("focuses selected recognition attempts on target node and candidate edge", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", node("node-b", "B")),
        event(2, "next-list", "succeeded", node("node-b", "B"), {
          next: [{ name: "C", jumpBack: false, anchor: true }],
        }),
        event(3, "recognition", "succeeded", node("node-c", "C"), {
          parentNode: "B",
          hit: true,
        }),
        event(4, "node", "succeeded", node("node-b", "B")),
      ],
    });
    const records = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
      { attributionMode: "next", resolverEdges },
    );
    const selectedRecord = records.find((record) => record.runtimeName === "B");
    const selectedAttempt = selectedRecord?.recognitionAttempts[0];

    const overlay = selectDebugNodeExecutionOverlayForSelection({
      records,
      selectedRecord,
      selectedAttempt,
      resolverEdges,
      resolverNodes,
    });

    expect(overlay.selectedExecutionAttemptId).toBe(selectedAttempt?.id);
    expect(overlay.selectedExecutionAttemptNodeId).toBe("node-c");
    expect(overlay.selectedExecutionAttemptEdgeIds).toEqual(["edge-b-c"]);
    expect(overlay.executionCandidateEdgeIds).toContain("edge-b-c");
  });

  it("uses node-mode source NextList owner for selected attempt edge focus", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", node("node-b", "B")),
        event(2, "next-list", "succeeded", node("node-b", "B"), {
          next: [{ name: "C", jumpBack: false, anchor: true }],
        }),
        event(3, "recognition", "succeeded", node("node-c", "C"), {
          parentNode: "B",
          hit: true,
        }),
      ],
    });
    const records = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
      { attributionMode: "node", resolverEdges },
    );
    const selectedRecord = records.find((record) => record.runtimeName === "C");
    const selectedAttempt = selectedRecord?.recognitionAttempts[0];

    const overlay = selectDebugNodeExecutionOverlayForSelection({
      records,
      selectedRecord,
      selectedAttempt,
      resolverEdges,
      resolverNodes,
    });

    expect(overlay.selectedExecutionNodeId).toBe("node-c");
    expect(overlay.selectedExecutionAttemptNodeId).toBe("node-c");
    expect(overlay.selectedExecutionAttemptEdgeIds).toEqual(["edge-b-c"]);
  });

  it("does not infer canvas edges for tasker bootstrap attempts", () => {
    const taskerEdge = {
      edgeId: "edge-tasker-a",
      fromRuntimeName: DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
      toRuntimeName: "A",
      reason: "candidate",
    } satisfies ResolverEdge;
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", taskerBootstrapNode()),
        event(2, "next-list", "succeeded", taskerBootstrapNode(), {
          next: [{ name: "A", jumpBack: false, anchor: false }],
        }),
        event(3, "recognition", "succeeded", node("node-a", "A"), {
          parentNode: DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
          hit: true,
        }),
      ],
    });
    const records = selectDebugNodeExecutionRecords(
      summary,
      resolverNodes,
      { status: "all" },
      { attributionMode: "next", resolverEdges: [taskerEdge] },
    );
    const selectedRecord = records.find((record) => record.syntheticKind);
    const selectedAttempt = selectedRecord?.recognitionAttempts[0];

    const overlay = selectDebugNodeExecutionOverlayForSelection({
      records,
      selectedRecord,
      selectedAttempt,
      resolverEdges: [taskerEdge],
      resolverNodes,
    });

    expect(overlay.selectedExecutionNodeId).toBeUndefined();
    expect(overlay.selectedExecutionAttemptEdgeIds).toEqual([]);
    expect(overlay.executionCandidateEdgeIds).toEqual([]);
  });

  it("keeps runtime-only selected attempts off canvas focus", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", { runtimeName: "RuntimeOnly" }),
        event(2, "recognition", "failed", { runtimeName: "MissingTarget" }),
      ],
    });
    const records = selectDebugNodeExecutionRecords(summary, resolverNodes, {
      status: "all",
    });
    const selectedRecord = records.find(
      (record) => record.runtimeName === "RuntimeOnly",
    );
    const selectedAttempt = selectedRecord?.recognitionAttempts[0];

    const overlay = selectDebugNodeExecutionOverlayForSelection({
      records,
      selectedRecord,
      selectedAttempt,
      resolverEdges,
      resolverNodes,
    });

    expect(overlay.selectedExecutionNodeId).toBeUndefined();
    expect(overlay.selectedExecutionAttemptNodeId).toBeUndefined();
    expect(overlay.selectedExecutionAttemptEdgeIds).toEqual([]);
  });

  it("resolves attempt artifact auto-load targets without bulk preloading", () => {
    const directImageAttempt = attempt({
      detailRefs: ["detail-1"],
      screenshotRefs: ["shot-1"],
    });
    expect(resolveAutoLoadAttemptArtifact({}, directImageAttempt)).toBe(
      "shot-1",
    );
    expect(
      resolveAutoLoadAttemptArtifact({}, directImageAttempt, "shot-1"),
    ).toBeUndefined();

    const detailOnlyAttempt = attempt({ detailRefs: ["detail-2"] });
    expect(resolveAutoLoadAttemptArtifact({}, detailOnlyAttempt)).toBe(
      "detail-2",
    );
    expect(
      resolveAutoLoadAttemptArtifact(
        { "detail-2": artifactEntry("detail-2", "loading") },
        detailOnlyAttempt,
        "detail-2",
      ),
    ).toBeUndefined();

    expect(
      resolveAutoLoadAttemptArtifact(
        {
          "detail-2": artifactEntry("detail-2", "ready", {
            rawImageRef: "raw-1",
            drawImageRefs: ["draw-1"],
          }),
        },
        detailOnlyAttempt,
        "detail-2",
      ),
    ).toBe("raw-1");

    const actionAttempt = attempt({
      kind: "action",
      detailRefs: ["action-detail"],
      screenshotRefs: [],
    });
    expect(resolveAutoLoadAttemptArtifact({}, actionAttempt)).toBeUndefined();
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

function attempt({
  detailRefs = [],
  kind = "recognition",
  screenshotRefs = [],
}: {
  detailRefs?: string[];
  kind?: DebugNodeExecutionAttempt["kind"];
  screenshotRefs?: string[];
}): DebugNodeExecutionAttempt {
  return {
    id: `${kind}-attempt`,
    kind,
    firstSeq: 1,
    lastSeq: 1,
    detailRef: detailRefs[0],
    screenshotRef: screenshotRefs[0],
    detailRefs,
    screenshotRefs,
    maafwMessages: [],
    events: [],
  };
}

function artifactEntry(
  id: string,
  status: DebugArtifactEntry["status"],
  data?: unknown,
): DebugArtifactEntry {
  return {
    ref: {
      id,
      sessionId: "session-1",
      type: "recognition-detail",
      mime: "application/json",
      createdAt: "2026-04-29T00:00:00.000Z",
    },
    status,
    payload: data === undefined ? undefined : payload(data),
  };
}

function payload(data: unknown): DebugArtifactPayload {
  return {
    ref: {
      id: "detail-payload",
      sessionId: "session-1",
      type: "recognition-detail",
      mime: "application/json",
      createdAt: "2026-04-29T00:00:00.000Z",
    },
    data,
  };
}
