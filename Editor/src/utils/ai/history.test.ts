import { describe, expect, it } from "vitest";
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
});
