import { beforeEach, describe, expect, it } from "vitest";

import type {
  DocumentOpenResult,
  WorkspaceDocument,
} from "../services/generated/bridge-v2";
import { getDirtyDocumentPaths, useDocumentStore } from "./documentStore";

const descriptor: WorkspaceDocument = {
  path: "notes.jsonc",
  name: "notes.jsonc",
  kind: "json",
  language: "json",
  mimeType: "application/json",
  size: 8,
  editable: true,
  previewable: true,
};

const opened: DocumentOpenResult = {
  ...descriptor,
  content: "{\n}\n",
  encoding: "utf-8",
  revision: "r1",
};

describe("documentStore", () => {
  beforeEach(() => useDocumentStore.getState().clearProject());

  it("ignores stale document capability revisions", () => {
    const store = useDocumentStore.getState();
    store.applyDocuments({ revision: 3, root: "C:/project", documents: [descriptor] });
    store.applyDocuments({ revision: 2, root: "C:/project", documents: [] });

    expect(useDocumentStore.getState().documents).toHaveProperty("notes.jsonc");
    expect(useDocumentStore.getState().revision).toBe(3);
  });

  it("tracks drafts and updates the base revision after saving", () => {
    const store = useDocumentStore.getState();
    store.applyDocuments({ revision: 1, root: "C:/project", documents: [descriptor] });
    store.beginOpen(descriptor.path);
    store.finishOpen(opened);
    store.updateContent(descriptor.path, "{\n  \"changed\": true\n}\n");

    expect(getDirtyDocumentPaths()).toEqual([descriptor.path]);

    store.markSaved(descriptor.path, "r2");
    expect(useDocumentStore.getState().opened[descriptor.path]).toMatchObject({
      dirty: false,
      baseRevision: "r2",
    });
  });

  it("supports keeping a local draft or reloading an external conflict", () => {
    const store = useDocumentStore.getState();
    store.applyDocuments({ revision: 1, root: "C:/project", documents: [descriptor] });
    store.beginOpen(descriptor.path);
    store.finishOpen(opened);
    store.updateContent(descriptor.path, "local");
    const external = { ...opened, content: "external", revision: "r2" };
    store.setConflict(descriptor.path, external);
    store.keepLocal(descriptor.path);

    expect(useDocumentStore.getState().opened[descriptor.path]).toMatchObject({
      content: "local",
      baseRevision: "r2",
      dirty: true,
      conflict: undefined,
    });

    store.setConflict(descriptor.path, { ...external, revision: "r3" });
    store.reloadExternal(descriptor.path, { ...external, revision: "r3" });
    expect(useDocumentStore.getState().opened[descriptor.path]).toMatchObject({
      content: "external",
      baseRevision: "r3",
      dirty: false,
    });
  });

  it("retains opened drafts while preparing a reconnect", () => {
    const store = useDocumentStore.getState();
    store.applyDocuments({ revision: 4, root: "C:/project", documents: [descriptor] });
    store.beginOpen(descriptor.path);
    store.finishOpen(opened);
    store.updateContent(descriptor.path, "draft");

    store.prepareReconnect();

    expect(useDocumentStore.getState().revision).toBe(0);
    expect(useDocumentStore.getState().opened[descriptor.path].content).toBe("draft");
  });
});
