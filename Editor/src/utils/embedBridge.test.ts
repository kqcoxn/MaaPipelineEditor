import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CAPABILITIES,
  DEFAULT_UI,
  getEmbedHostName,
  initEmbedBridge,
  isCompatibleProtocolVersion,
  PROTOCOL_VERSION,
  sendToParent,
} from "./embedBridge";
import { useEmbedMessageLogStore } from "@/stores/embed/embedMessageLogStore";

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
          version: "1.1.0",
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

  it("accepts the same major version and rejects incompatible versions", () => {
    expect(PROTOCOL_VERSION).toBe("1.4.0");
    expect(isCompatibleProtocolVersion("1.0.0")).toBe(true);
    expect(isCompatibleProtocolVersion("1.9.0")).toBe(true);
    expect(isCompatibleProtocolVersion("2.0.0")).toBe(false);
    expect(isCompatibleProtocolVersion(undefined)).toBe(false);
  });

  it("disables host node navigation unless the host declares it", () => {
    expect(DEFAULT_CAPABILITIES.hostNodeNavigation).toBe(false);
  });

  it("reports an incompatible parent protocol version", () => {
    const postMessage = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => undefined);
    ({ cleanup } = initEmbedBridge());

    window.dispatchEvent(
      new MessageEvent("message", {
        source: window.parent,
        origin: "https://host.example.com",
        data: {
          protocol: "mpe-embed",
          version: "2.0.0",
          type: "mpe:init",
          requestId: "request-incompatible",
          payload: {},
        },
      }),
    );

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "mpe:error",
        requestId: "request-incompatible",
        payload: expect.objectContaining({
          code: "protocol_version_mismatch",
        }),
      }),
      "https://host.example.com",
    );
  });
});

describe("getEmbedHostName", () => {
  it.each([
    [{ id: "test-host", name: "Test Host" }, "Test Host"],
    [{ id: "custom-editor", name: "Custom Editor" }, "Custom Editor"],
    [{ id: "mse", name: "Maa Support" }, "Maa Support"],
  ])("uses host.name for %o", (host, expected) => {
    expect(getEmbedHostName(host, "zh-cn")).toBe(expected);
  });

  it("falls back by locale when host information is missing", () => {
    expect(getEmbedHostName(null, "zh-cn")).toBe("宿主");
    expect(getEmbedHostName(undefined, "en-us")).toBe("Host");
    expect(getEmbedHostName({ id: "custom-editor", name: "  " }, "en-us")).toBe(
      "Host",
    );
  });
});
