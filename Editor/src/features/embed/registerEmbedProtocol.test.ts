import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEmbedStore } from "../../stores/embedStore";
import { useFlowStore } from "../../stores/flow";
import {
  requestHostReload,
  requestHostSave,
} from "./embedOperations";
import { registerEmbedProtocol } from "./registerEmbedProtocol";
import { showEmbedSaveConflict } from "./saveConflict";

vi.mock("./saveConflict", () => ({
  showEmbedSaveConflict: vi.fn(),
}));

describe("registerEmbedProtocol", () => {
  let cleanup: (() => void) | undefined;
  let postMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.history.replaceState({}, "", "/?embed=true&origin=test-host");
    useEmbedStore.getState().reset();
    useFlowStore.getState().replace([], [], { skipHistory: true });
    useFlowStore.getState().clearHistory();
    postMessage = vi.fn();
    vi.mocked(showEmbedSaveConflict).mockClear();
    vi.spyOn(window.parent, "postMessage").mockImplementation(postMessage);
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    vi.restoreAllMocks();
  });

  function dispatchParentMessage(
    type: string,
    payload: unknown,
    requestId?: string,
  ): void {
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window.parent,
        data: {
          protocol: "mpe-embed",
          version: "1.1.0",
          type,
          requestId,
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
      host: {
        id: "mse",
        name: "Maa Support Extension",
        repositoryUrl: "https://github.com/neko-para/maa-support-extension",
      },
    });
    dispatchParentMessage("mpe:resize", { width: 800, height: 600 });

    expect(useEmbedStore.getState()).toMatchObject({
      isReady: true,
      capabilities: { readOnly: true },
      ui: { hideHeader: true },
      host: {
        id: "mse",
        name: "Maa Support Extension",
        repositoryUrl:
          "https://github.com/neko-para/maa-support-extension",
      },
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

  it("completes a host save with the matching request id", async () => {
    cleanup = registerEmbedProtocol();
    dispatchParentMessage("mpe:init", { capabilities: {}, ui: {} });
    dispatchParentMessage(
      "mpe:loadPipeline",
      { fileName: "pipeline.json", data: { Start: {} } },
      "load-1",
    );
    await vi.waitFor(() => {
      expect(useEmbedStore.getState().cleanPipeline).not.toBeNull();
    });

    const requestId = requestHostSave();
    expect(requestId).toEqual(expect.any(String));
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "mpe:saveRequest", requestId }),
      "*",
    );

    dispatchParentMessage("mpe:save", {}, requestId ?? undefined);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "mpe:saveData", requestId }),
      "*",
    );
    dispatchParentMessage(
      "mpe:saveResult",
      { success: true, documentVersion: 2 },
      requestId ?? undefined,
    );

    expect(useEmbedStore.getState()).toMatchObject({
      isDirty: false,
      saveOperation: { status: "success", requestId: null },
    });
  });

  it("reloads from the host without clearing the current state on host error", async () => {
    cleanup = registerEmbedProtocol();
    dispatchParentMessage("mpe:init", { capabilities: {}, ui: {} });
    dispatchParentMessage(
      "mpe:loadPipeline",
      { fileName: "pipeline.json", data: { Start: {} } },
      "load-1",
    );
    await vi.waitFor(() => {
      expect(useFlowStore.getState().nodes).toHaveLength(1);
    });

    const requestId = requestHostReload();
    dispatchParentMessage(
      "mpe:error",
      { code: "invalid_pipeline", message: "文档解析失败" },
      requestId ?? undefined,
    );

    expect(useEmbedStore.getState().reloadOperation).toMatchObject({
      status: "error",
      error: "文档解析失败",
    });
    expect(useFlowStore.getState().nodes).toHaveLength(1);
  });

  it("drops unsafe host repository URLs", () => {
    cleanup = registerEmbedProtocol();
    dispatchParentMessage("mpe:init", {
      capabilities: {},
      ui: {},
      host: {
        id: "mse",
        name: "MSE",
        repositoryUrl: "javascript:alert(1)",
      },
    });

    expect(useEmbedStore.getState().host).toEqual({ id: "mse", name: "MSE" });
  });

  it.each([
    { id: "test-host", name: "Test Host" },
    { id: "custom-editor", name: "Custom Editor" },
    { id: "mse", name: "Maa Support" },
  ])("uses the same conflict state machine for host $id", (host) => {
    cleanup = registerEmbedProtocol();
    dispatchParentMessage("mpe:init", { capabilities: {}, ui: {}, host });
    useEmbedStore.getState().setDirty(true);
    const requestId = requestHostSave();

    dispatchParentMessage(
      "mpe:saveResult",
      {
        success: false,
        code: "document_changed",
        message: `Natural-language message from ${host.id}`,
        canForce: true,
      },
      requestId ?? undefined,
    );

    expect(showEmbedSaveConflict).toHaveBeenCalledWith({ canForce: true });
    expect(useEmbedStore.getState()).toMatchObject({
      host,
      isDirty: true,
      saveOperation: { status: "conflict", requestId: null, error: null },
    });
  });

  it("does not infer conflicts from a natural-language message", () => {
    cleanup = registerEmbedProtocol();
    dispatchParentMessage("mpe:init", { capabilities: {}, ui: {} });
    const requestId = requestHostSave();

    dispatchParentMessage(
      "mpe:saveResult",
      {
        success: false,
        code: "save_failed",
        message: "document_changed",
        canForce: true,
      },
      requestId ?? undefined,
    );

    expect(showEmbedSaveConflict).not.toHaveBeenCalled();
  });

  it("ignores a document conflict for a stale request id", () => {
    cleanup = registerEmbedProtocol();
    dispatchParentMessage("mpe:init", { capabilities: {}, ui: {} });
    const requestId = requestHostSave();

    dispatchParentMessage(
      "mpe:saveResult",
      { success: false, code: "document_changed", canForce: true },
      `${requestId}-stale`,
    );

    expect(showEmbedSaveConflict).not.toHaveBeenCalled();
    expect(useEmbedStore.getState().saveOperation).toMatchObject({
      status: "pending",
      requestId,
    });
  });
});
