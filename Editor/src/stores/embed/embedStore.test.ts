import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CAPABILITIES, DEFAULT_UI } from "@/utils/embedBridge";
import { useEmbedStore } from "@/stores/embed/embedStore";

describe("embedStore", () => {
  beforeEach(() => {
    useEmbedStore.getState().reset();
  });

  it("maps dedicated header and toolbar flags to panel visibility", () => {
    useEmbedStore.getState().initConfig({}, {
      hideHeader: true,
      hideToolbar: true,
      hiddenPanels: ["search"],
    });

    const state = useEmbedStore.getState();
    expect(state.isPanelHidden("header")).toBe(true);
    expect(state.isPanelHidden("toolbar")).toBe(true);
    expect(state.isPanelHidden("search")).toBe(true);
    expect(state.isPanelHidden("field")).toBe(false);
  });

  it("restores all embed state when reset", () => {
    const state = useEmbedStore.getState();
    state.initConfig(
      { readOnly: true },
      { hideHeader: true },
      { id: "mse", name: "MSE" },
    );
    state.setFileName("pipeline.json");
    state.setAnchorDefinitions([
      {
        anchorName: "Entry",
        nodeName: "RemoteNode",
        fileName: "remote.json",
        relativePath: "pipelines/remote.json",
        isCurrentFile: false,
      },
    ]);
    state.markClean('{"A":{}}');
    state.beginSave("save-1");
    state.beginReload("reload-1");
    state.setReady(true);

    useEmbedStore.getState().reset();

    expect(useEmbedStore.getState()).toMatchObject({
      isReady: false,
      capabilities: DEFAULT_CAPABILITIES,
      ui: DEFAULT_UI,
      host: null,
      currentFileName: null,
      anchorDefinitions: [],
      cleanPipeline: null,
      isDirty: false,
      saveOperation: { status: "idle", requestId: null, error: null },
      reloadOperation: { status: "idle", requestId: null, error: null },
    });
  });

  it("keeps post-save changes dirty while advancing the clean baseline", () => {
    const state = useEmbedStore.getState();
    state.markClean('{"A":{}}');
    state.setDirty(true);
    state.beginSave("save-1");
    state.captureSavePipeline("save-1", '{"A":{"next":["B"]}}');

    useEmbedStore
      .getState()
      .finishSave(
        "save-1",
        true,
        '{"A":{"next":["B"]},"B":{}}',
      );

    expect(useEmbedStore.getState()).toMatchObject({
      cleanPipeline: '{"A":{"next":["B"]}}',
      isDirty: true,
      saveOperation: { status: "success" },
    });
  });

  it("ignores operation results with a different request id", () => {
    const state = useEmbedStore.getState();
    state.beginReload("reload-current");

    state.finishReload("reload-stale", false, "stale error");

    expect(useEmbedStore.getState().reloadOperation).toEqual({
      status: "pending",
      requestId: "reload-current",
      error: null,
    });
  });
});
