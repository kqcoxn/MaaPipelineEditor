import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEmbedStore } from "../../stores/embedStore";
import {
  clearEmbedOperationTimeouts,
  requestHostReload,
  requestHostSave,
} from "./embedOperations";

describe("embedOperations", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/?embed=true&origin=test-host");
    useEmbedStore.getState().reset();
    useEmbedStore.getState().setReady(true);
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => undefined);
  });

  afterEach(() => {
    clearEmbedOperationTimeouts();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("times out a reload without clearing dirty state", () => {
    useEmbedStore.getState().setDirty(true);
    const requestId = requestHostReload();

    vi.advanceTimersByTime(10_000);

    expect(requestId).toEqual(expect.any(String));
    expect(useEmbedStore.getState()).toMatchObject({
      isDirty: true,
      reloadOperation: {
        status: "error",
        requestId: null,
        error: "等待宿主同步响应超时",
      },
    });
  });

  it("does not start a reload while save is pending", () => {
    const saveRequestId = requestHostSave();
    const reloadRequestId = requestHostReload();

    expect(saveRequestId).toEqual(expect.any(String));
    expect(reloadRequestId).toBeNull();
    expect(useEmbedStore.getState().reloadOperation.status).toBe("idle");
  });
});
