import { describe, expect, it, vi } from "vitest";
import {
  AIHistoryManager,
  MAX_AI_HISTORY_RECORDS,
} from "./history";

describe("AIHistoryManager", () => {
  it("caps records and does not retain image Base64 data", () => {
    const manager = new AIHistoryManager();

    for (let index = 0; index <= MAX_AI_HISTORY_RECORDS; index++) {
      manager.addRecord({
        userPrompt: `prompt-${index}`,
        actualMessage: "message",
        response: "response",
        success: true,
        imageBase64: "data:image/png;base64,large-payload",
      });
    }

    const records = manager.getRecords();
    expect(records).toHaveLength(MAX_AI_HISTORY_RECORDS);
    expect(records[0]?.userPrompt).toBe(`prompt-${MAX_AI_HISTORY_RECORDS}`);
    expect(records[0]?.hasImage).toBe(true);
    expect(records[0]?.imageBase64).toBeUndefined();
  });

  it("isolates records between Sessions and switches the active Session", () => {
    const manager = new AIHistoryManager();
    const firstSessionId = manager.getActiveSessionId();
    const secondSession = manager.createSession("视觉分析");

    manager.addRecord({
      userPrompt: "第二个 Session 的问题",
      actualMessage: "第二个 Session 的问题",
      response: "answer",
      success: true,
    });
    manager.setActiveSession(firstSessionId);
    manager.addRecord({
      userPrompt: "第一个 Session 的问题",
      actualMessage: "第一个 Session 的问题",
      response: "answer",
      success: true,
    });

    expect(manager.getRecords(firstSessionId)).toHaveLength(1);
    expect(manager.getRecords(secondSession.id)).toHaveLength(1);
    expect(manager.getActiveSessionId()).toBe(firstSessionId);
    expect(manager.getRecords()[0]?.userPrompt).toBe("第一个 Session 的问题");
  });

  it("notifies subscribers when Sessions change and keeps one Session after delete", () => {
    const manager = new AIHistoryManager();
    const listener = vi.fn();
    const unsubscribe = manager.subscribe(listener);
    const session = manager.createSession();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(manager.deleteSession(session.id)).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(manager.getSessions()).toHaveLength(1);

    unsubscribe();
    manager.createSession();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
