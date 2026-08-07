import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CAPABILITIES,
  DEFAULT_UI,
  initEmbedBridge,
  sendToParent,
} from "./embedBridge";
import { useEmbedMessageLogStore } from "../stores/embedMessageLogStore";

describe("embedBridge", () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState(
      {},
      "",
      "/?embed=true&origin=https%3A%2F%2Fhost.example.com%2Fworkspace",
    );
    useEmbedMessageLogStore.getState().clearLogs();
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("uses the configured HTTP origin when posting to the parent", () => {
    const postMessage = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => undefined);

    sendToParent("mpe:test", { ok: true });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "mpe:test" }),
      "https://host.example.com",
    );
  });

  it("applies default state before completing a timed-out handshake", () => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
    const onHandshakeTimeout = vi.fn();
    ({ cleanup } = initEmbedBridge({ onHandshakeTimeout }));

    vi.advanceTimersByTime(5000);

    expect(onHandshakeTimeout).toHaveBeenCalledWith(
      DEFAULT_CAPABILITIES,
      DEFAULT_UI,
    );
  });

  it("records validated messages received from the parent", () => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
    ({ cleanup } = initEmbedBridge());

    window.dispatchEvent(
      new MessageEvent("message", {
        source: window.parent,
        origin: "https://host.example.com",
        data: {
          protocol: "mpe-embed",
          version: "1.0.0",
          type: "mpe:init",
          requestId: "request-1",
          payload: { capabilities: {}, ui: {} },
        },
      }),
    );

    expect(useEmbedMessageLogStore.getState().logs).toContainEqual(
      expect.objectContaining({
        direction: "incoming",
        type: "mpe:init",
        requestId: "request-1",
        origin: "https://host.example.com",
      }),
    );
  });
});
