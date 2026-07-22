import { beforeEach, describe, expect, it } from "vitest";

import {
  documentTabKey,
  pipelineTabKey,
  useProjectSessionStore,
} from "./projectSessionStore";

describe("projectSessionStore", () => {
  beforeEach(() => useProjectSessionStore.getState().clear());

  it("mixes pipeline and document tabs while preserving order", () => {
    const store = useProjectSessionStore.getState();
    store.openPipeline("pipeline/main.json");
    store.openDocument("README.md");
    store.openPipeline("pipeline/next.json");

    expect(useProjectSessionStore.getState().tabs.map((tab) => tab.kind)).toEqual([
      "pipeline",
      "document",
      "pipeline",
    ]);
    expect(useProjectSessionStore.getState().activeKey).toBe(
      pipelineTabKey("pipeline/next.json"),
    );
  });

  it("selects the adjacent tab when closing the active item", () => {
    const store = useProjectSessionStore.getState();
    store.openPipeline("pipeline/main.json");
    store.openDocument("README.md");
    store.openDocument("notes.txt");

    const next = store.closeTab(documentTabKey("README.md"));

    expect(next).toBe(documentTabKey("notes.txt"));
  });

  it("allows the last pipeline tab to close", () => {
    const store = useProjectSessionStore.getState();
    store.openPipeline("pipeline/missing.json");

    const next = store.closeTab(pipelineTabKey("pipeline/missing.json"));

    expect(next).toBeNull();
    expect(useProjectSessionStore.getState().tabs).toEqual([]);
  });

  it("syncs pipeline tabs without removing document tabs", () => {
    const store = useProjectSessionStore.getState();
    store.openPipeline("old.json");
    store.openDocument("README.md");

    store.syncPipelineTabs(["new.json"]);

    expect(useProjectSessionStore.getState().tabs.map((tab) => tab.key)).toEqual([
      documentTabKey("README.md"),
      pipelineTabKey("new.json"),
    ]);
  });

  it("keeps the session empty when no pipelines are open", () => {
    const store = useProjectSessionStore.getState();

    store.syncPipelineTabs([]);

    expect(useProjectSessionStore.getState()).toMatchObject({
      tabs: [],
      activeKey: null,
    });
  });

  it("migrates directory paths, tab keys, and the active key on rename", () => {
    const store = useProjectSessionStore.getState();
    store.openPipeline("resource/pipeline/main.json");
    store.openDocument("resource/notes.jsonc");

    store.renamePath("resource", "assets/resource", true);

    expect(useProjectSessionStore.getState()).toMatchObject({
      tabs: [
        {
          path: "assets/resource/pipeline/main.json",
          key: pipelineTabKey("assets/resource/pipeline/main.json"),
        },
        {
          path: "assets/resource/notes.jsonc",
          key: documentTabKey("assets/resource/notes.jsonc"),
        },
      ],
      activeKey: documentTabKey("assets/resource/notes.jsonc"),
    });
  });
});
