import { beforeEach, describe, expect, it } from "vitest";

import { reduceDebugTrace } from "../features/debug/traceReducer";
import type { DebugEvent } from "../features/debug/types";
import { useDebugOverlayStore } from "./debugOverlayStore";

function createEvent(
  seq: number,
  event: Partial<DebugEvent>,
): DebugEvent {
  return {
    sessionId: "session-1",
    runId: "run-1",
    seq,
    timestamp: `2026-07-19T00:00:0${seq}.000Z`,
    source: "maafw",
    kind: "node",
    ...event,
  };
}

beforeEach(() => {
  useDebugOverlayStore.getState().clearOverlay();
});

describe("debug overlay store", () => {
  it("does not restore node highlights from events arriving after run completion", () => {
    const summary = reduceDebugTrace({
      events: [
        createEvent(1, {
          phase: "starting",
          status: "running",
          node: {
            runtimeName: "NodeA",
            nodeId: "node-a",
          },
        }),
        createEvent(2, {
          source: "localbridge",
          kind: "session",
          phase: "completed",
          status: "completed",
        }),
        createEvent(3, {
          kind: "recognition",
          phase: "starting",
          status: "running",
          node: {
            runtimeName: "NodeA",
            nodeId: "node-a",
          },
        }),
      ],
    });

    expect(summary.status).toBe("completed");
    expect(summary.currentNodeId).toBe("node-a");

    useDebugOverlayStore.getState().applyTraceSummary(summary);

    const overlay = useDebugOverlayStore.getState();
    expect(overlay.currentNodeId).toBeUndefined();
    expect(overlay.activeRecognitionNodeIds).toEqual(new Set());
  });
});
