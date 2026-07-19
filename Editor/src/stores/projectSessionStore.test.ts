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
});
