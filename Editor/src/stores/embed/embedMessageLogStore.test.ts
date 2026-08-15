import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEmbedMessageLogStore } from "@/stores/embed/embedMessageLogStore";

describe("embedMessageLogStore", () => {
  beforeEach(() => {
    useEmbedMessageLogStore.getState().clearLogs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records message metadata and payload", () => {
    vi.spyOn(Date, "now").mockReturnValue(1234);

    useEmbedMessageLogStore.getState().addLog({
      direction: "incoming",
      type: "mpe:init",
      version: "1.0.0",
      requestId: "request-1",
      origin: "https://host.example.com",
      payload: { readOnly: true },
    });

    expect(useEmbedMessageLogStore.getState().logs[0]).toMatchObject({
      timestamp: 1234,
      direction: "incoming",
      type: "mpe:init",
      requestId: "request-1",
      payload: { readOnly: true },
    });
  });

  it("keeps only the latest 200 messages", () => {
    const store = useEmbedMessageLogStore.getState();
    for (let index = 0; index < 205; index += 1) {
      store.addLog({
        direction: "outgoing",
        type: `message-${index}`,
        version: "1.0.0",
        origin: "*",
        payload: {},
      });
    }

    const logs = useEmbedMessageLogStore.getState().logs;
    expect(logs).toHaveLength(200);
    expect(logs[0].type).toBe("message-5");
    expect(logs.at(-1)?.type).toBe("message-204");
  });
});
