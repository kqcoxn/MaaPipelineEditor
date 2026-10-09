import { describe, expect, it, vi } from "vitest";
import { RecorderProtocol } from "./RecorderProtocol";
import type { LocalWebSocketServer } from "../server";
import { makeRunRequest, newStep } from "@/features/recorder/types";

it("isolates concurrent replies by request ID and rejects pending requests on disconnect", async () => {
  let receive: (data: unknown) => void = () => {};
  let status: (connected: boolean) => void = () => {};
  const sent: { path: string; data: { request_id: string } }[] = [];
  const server = {
    registerRoute: (_: string, callback: typeof receive) => {
      receive = callback;
    },
    onStatus: (callback: typeof status) => {
      status = callback;
      return () => {};
    },
    send: (path: string, data: { request_id: string }) => {
      sent.push({ path, data });
      return true;
    },
  };
  const client = new RecorderProtocol();
  client.register(server as unknown as LocalWebSocketServer);
  const first = client.run(makeRunRequest(newStep(), "preview", "device", ""));
  const second = client.run(makeRunRequest(newStep(), "preview", "device", ""));
  receive({ request_id: "old", success: true });
  receive({ request_id: sent[1].data.request_id, success: true, hit: false });
  expect((await second).hit).toBe(false);
  const rejected = expect(first).rejects.toThrow("断开");
  status(false);
  await rejected;
  receive({ request_id: sent[0].data.request_id, success: true, hit: true });
});
describe("Recorder request timeout", () => {
  it("does not retry potentially executed device input", async () => {
    vi.useFakeTimers();
    try {
      const send = vi.fn(() => true);
      const client = new RecorderProtocol();
      client.register({
        registerRoute() {},
        onStatus: () => () => {},
        send,
      } as unknown as LocalWebSocketServer);
      const result = client.run(
        makeRunRequest(newStep(), "execute", "device", ""),
      );
      const rejected = expect(result).rejects.toThrow("超时");
      await vi.advanceTimersByTimeAsync(65000);
      await rejected;
      expect(send).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
