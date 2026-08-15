import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEmbedStore } from "@/stores/embed/embedStore";
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

  it("sends explicit non-force semantics for a normal save", () => {
    const postMessage = vi.mocked(window.parent.postMessage);

    const requestId = requestHostSave();

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "mpe:saveRequest",
        requestId,
        payload: { hint: "user-triggered", force: false },
      }),
      "*",
    );
  });

  it("uses a new request id and only generic force fields after confirmation", () => {
    const postMessage = vi.mocked(window.parent.postMessage);
    const normalRequestId = requestHostSave();
    useEmbedStore
      .getState()
      .finishSave(normalRequestId ?? undefined, false, "", "conflict");

    const forceRequestId = requestHostSave({
      hint: "user-confirmed-force",
      force: true,
    });

    expect(forceRequestId).not.toBe(normalRequestId);
    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "mpe:saveRequest",
        requestId: forceRequestId,
        payload: { hint: "user-confirmed-force", force: true },
      }),
      "*",
    );
    expect(JSON.stringify(postMessage.mock.calls.at(-1))).not.toMatch(
      /vscode|disk|filesystem/i,
    );
  });
});
