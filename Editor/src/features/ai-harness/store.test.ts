import { beforeEach, describe, expect, it } from "vitest";
import { MAX_EVENTS_PER_RUN, MAX_RUNS_PER_SESSION } from "./constants";
import { canvasChatProfile } from "./registry";
import { useAIHarnessStore } from "./store";
import type { HarnessRun, RunEvent } from "./types";

function createRun(id: string, sessionId: string): HarnessRun {
  return {
    id,
    sessionId,
    goal: id,
    status: "queued",
    createdAt: Date.now(),
    profileSnapshot: canvasChatProfile,
    capabilitySnapshot: {
      id: "canvas",
      version: "1",
      description: "canvas",
      toolNames: [],
    },
    policySnapshot: canvasChatProfile.defaultPolicy,
    modelSnapshot: {
      type: "openai",
      apiUrl: "https://example.com",
      model: "test",
      temperature: 0,
    },
    turnCount: 0,
    toolCallCount: 0,
    tokenUsage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      isEstimated: false,
    },
    changedCanvas: false,
  };
}

describe("useAIHarnessStore", () => {
  beforeEach(() => useAIHarnessStore.getState().reset());

  it("隔离 Session 并清理所属 Run 和 Event", () => {
    const store = useAIHarnessStore.getState();
    const firstSessionId = store.activeSessionId;
    store.addRun(createRun("run-a", firstSessionId));
    const secondSessionId = store.createSession("第二个");
    store.addRun(createRun("run-b", secondSessionId));
    store.updateRun("run-a", { status: "succeeded", finishedAt: Date.now() });

    expect(useAIHarnessStore.getState().sessions).toHaveLength(2);
    store.clearSession(firstSessionId);

    const state = useAIHarnessStore.getState();
    expect(state.runs["run-a"]).toBeUndefined();
    expect(state.runs["run-b"]).toBeDefined();
  });

  it("限制每个 Session 的 Run 和每个 Run 的 Event 数量", () => {
    const store = useAIHarnessStore.getState();
    const sessionId = store.activeSessionId;
    for (let index = 0; index < MAX_RUNS_PER_SESSION + 2; index += 1) {
      store.addRun(createRun(`run-${index}`, sessionId));
    }

    const retainedRunId = `run-${MAX_RUNS_PER_SESSION + 1}`;
    for (let index = 0; index < MAX_EVENTS_PER_RUN + 5; index += 1) {
      store.appendEvent({
        id: `event-${index}`,
        runId: retainedRunId,
        sessionId,
        type: "assistant_delta",
        timestamp: index,
      } satisfies RunEvent);
    }

    const state = useAIHarnessStore.getState();
    expect(state.sessions[0].runIds).toHaveLength(MAX_RUNS_PER_SESSION);
    expect(state.runs["run-0"]).toBeUndefined();
    expect(state.events[retainedRunId]).toHaveLength(MAX_EVENTS_PER_RUN);
    expect(state.events[retainedRunId][0].id).toBe("event-5");
  });
});
