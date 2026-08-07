import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEmbedStore } from "../../stores/embedStore";
import { registerEmbedProtocol } from "./registerEmbedProtocol";

describe("registerEmbedProtocol", () => {
  let cleanup: (() => void) | undefined;
  let postMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.history.replaceState({}, "", "/?embed=true&origin=test-host");
    useEmbedStore.getState().reset();
    postMessage = vi.fn();
    vi.spyOn(window.parent, "postMessage").mockImplementation(postMessage);
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    vi.restoreAllMocks();
  });

  function dispatchParentMessage(type: string, payload: unknown): void {
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window.parent,
        data: {
          protocol: "mpe-embed",
          version: "1.0.0",
          type,
          payload,
        },
      }),
    );
  }

  it("becomes ready after init and forwards resize notifications", () => {
    const onResize = vi.fn();
    window.addEventListener("resize", onResize);
    cleanup = registerEmbedProtocol();

    dispatchParentMessage("mpe:init", {
      capabilities: { readOnly: true },
      ui: { hideHeader: true },
    });
    dispatchParentMessage("mpe:resize", { width: 800, height: 600 });

    expect(useEmbedStore.getState()).toMatchObject({
      isReady: true,
      capabilities: { readOnly: true },
      ui: { hideHeader: true },
    });
    expect(onResize).toHaveBeenCalledOnce();
    window.removeEventListener("resize", onResize);
  });

  it("disposes protocol state when destroy is received", () => {
    cleanup = registerEmbedProtocol();
    dispatchParentMessage("mpe:init", { capabilities: {}, ui: {} });

    dispatchParentMessage("mpe:destroy", {});

    expect(useEmbedStore.getState().isReady).toBe(false);
    dispatchParentMessage("mpe:init", { capabilities: {}, ui: {} });
    expect(useEmbedStore.getState().isReady).toBe(false);
  });

  it("returns saved pipeline data as an object", () => {
    cleanup = registerEmbedProtocol();
    dispatchParentMessage("mpe:init", { capabilities: {}, ui: {} });

    dispatchParentMessage("mpe:save", {});

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "mpe:saveData",
        payload: expect.objectContaining({ data: expect.any(Object) }),
      }),
      "*",
    );
  });
});
