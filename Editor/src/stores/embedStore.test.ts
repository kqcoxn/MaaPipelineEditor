import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CAPABILITIES, DEFAULT_UI } from "../utils/embedBridge";
import { useEmbedStore } from "./embedStore";

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
    state.initConfig({ readOnly: true }, { hideHeader: true });
    state.setFileName("pipeline.json");
    state.setReady(true);

    useEmbedStore.getState().reset();

    expect(useEmbedStore.getState()).toMatchObject({
      isReady: false,
      capabilities: DEFAULT_CAPABILITIES,
      ui: DEFAULT_UI,
      currentFileName: null,
    });
  });
});
