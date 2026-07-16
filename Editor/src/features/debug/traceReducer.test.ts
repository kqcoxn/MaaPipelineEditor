import { describe, expect, it } from "vitest";
import {
  reduceDebugTrace,
  reduceDebugTraceForReplay,
} from "./traceReducer";
import {
  DEBUG_TASKER_BOOTSTRAP_LABEL,
  DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
  type DebugEvent,
  type DebugEventKind,
  type DebugEventPhase,
} from "./types";

describe("reduceDebugTrace node execution replays", () => {
  it("splits repeated node starts into separate occurrences", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "session", "starting", undefined, { mode: "run-from-node" }),
        event(2, "node", "starting", node("node-a", "A")),
        event(3, "recognition", "succeeded", node("node-a", "A"), {
          algorithm: "TemplateMatch",
          hit: true,
        }),
        event(4, "node", "succeeded", node("node-a", "A")),
        event(5, "node", "starting", node("node-b", "B")),
        event(6, "action", "failed", node("node-b", "B"), undefined, {
          detailRef: "action-detail-b",
        }),
        event(7, "node", "failed", node("node-b", "B")),
        event(8, "node", "starting", node("node-a", "A")),
        event(9, "node", "succeeded", node("node-a", "A")),
      ],
    });

    expect(summary.nodeReplays["node-a"]).toHaveLength(2);
    expect(summary.nodeReplays["node-a"].map((item) => item.occurrence)).toEqual([
      1,
      2,
    ]);
    expect(summary.nodeReplays["node-a"][0].firstSeq).toBe(2);
    expect(summary.nodeReplays["node-a"][1].firstSeq).toBe(8);
    expect(summary.nodeReplays["node-b"][0].status).toBe("failed");
    expect(summary.nodeReplays["node-b"][0].detailRefs).toEqual([
      "action-detail-b",
    ]);
  });

  it("attaches child recognition events to the active parent runtime", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", node("node-a", "A")),
        event(
          2,
          "recognition",
          "succeeded",
          { runtimeName: "A.Reco" },
          { parentNode: "A" },
          { detailRef: "reco-detail", screenshotRef: "reco-image" },
        ),
        event(3, "node", "succeeded", node("node-a", "A")),
      ],
    });

    expect(summary.nodeReplays["node-a"]).toHaveLength(1);
    expect(summary.nodeReplays["node-a"][0].recognitionEvents).toHaveLength(1);
    expect(summary.nodeReplays["node-a"][0].detailRefs).toEqual([
      "reco-detail",
    ]);
    expect(summary.nodeReplays["node-a"][0].screenshotRefs).toEqual([
      "reco-image",
    ]);
    expect(summary.nodeReplays["runtime:A.Reco"]).toBeUndefined();
  });

  it("keeps bootstrap recognition under the synthetic Tasker replay", () => {
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

    const bootstrapReplay =
      summary.nodeReplays[`runtime:${DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME}`][0];
    expect(bootstrapReplay).toMatchObject({
      runtimeName: DEBUG_TASKER_BOOTSTRAP_RUNTIME_NAME,
      label: DEBUG_TASKER_BOOTSTRAP_LABEL,
      syntheticKind: "tasker-bootstrap",
      nodeId: undefined,
      fileId: undefined,
      unmapped: false,
    });
    expect(bootstrapReplay.nextListEvents).toHaveLength(1);
    expect(bootstrapReplay.recognitionEvents).toHaveLength(1);
    expect(bootstrapReplay.recognitionEvents[0].node?.runtimeName).toBe("A");
    expect(summary.nodeReplays["node-a"][0].firstSeq).toBe(5);
  });

  it("keeps runtimeName-only records when resolver mapping is missing", () => {
    const summary = reduceDebugTrace({
      events: [
        event(1, "node", "starting", { runtimeName: "MissingNode" }),
        event(2, "node", "failed", { runtimeName: "MissingNode" }),
      ],
    });

    const replay = summary.nodeReplays["runtime:MissingNode"][0];
    expect(replay.runtimeName).toBe("MissingNode");
    expect(replay.nodeId).toBeUndefined();
    expect(replay.unmapped).toBe(true);
    expect(replay.status).toBe("failed");
  });

  it("honors replay cursor filtering before reducing node occurrences", () => {
    const summary = reduceDebugTraceForReplay(
      {
        events: [
          event(1, "node", "starting", node("node-a", "A")),
          event(2, "node", "succeeded", node("node-a", "A")),
          event(3, "node", "starting", node("node-a", "A")),
          event(4, "node", "succeeded", node("node-a", "A")),
        ],
      },
      { active: true, cursorSeq: 2 },
    );

    expect(summary.nodeReplays["node-a"]).toHaveLength(1);
    expect(summary.nodeReplays["node-a"][0].lastSeq).toBe(2);
  });
});

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
    timestamp: `2026-04-29T00:00:0${seq}.000Z`,
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
