import { beforeEach, describe, expect, it } from "vitest";

import { asDocumentId } from "../features/project-session/types";
import { getDirtyDocumentIds, useDocumentStore } from "./documentStore";

const documentId = asDocumentId("document:notes");
const descriptor = {
  path: "notes.jsonc",
  name: "notes.jsonc",
  kind: "json" as const,
  language: "json",
  mimeType: "application/json",
  size: 2,
  editable: true,
  previewable: true,
};
const opened = {
  ...descriptor,
  revision: "r1",
  content: "{}",
};

describe("documentStore", () => {
  beforeEach(() => useDocumentStore.getState().clearProject());

  it("tracks content dirty state and request-time save baselines", () => {
    const store = useDocumentStore.getState();
    store.beginOpen(documentId, descriptor);
    store.finishOpen(documentId, opened);
    store.updateContent(documentId, '{"a":1}');
    const savedContent = useDocumentStore.getState().opened[documentId].content;
    store.updateContent(documentId, '{"a":2}');
    store.markSaved(documentId, "r2", savedContent);

    expect(useDocumentStore.getState().opened[documentId]).toMatchObject({
      savedContent: '{"a":1}',
      content: '{"a":2}',
      dirty: true,
      baseRevision: "r2",
    });
    expect(getDirtyDocumentIds()).toEqual([documentId]);
  });

  it("supports conflict retention and explicit external reload", () => {
    const store = useDocumentStore.getState();
    store.beginOpen(documentId, descriptor);
    store.finishOpen(documentId, opened);
    store.updateContent(documentId, "local");
    store.setConflict(documentId, { ...opened, content: "external", revision: "r2" });
    store.keepLocal(documentId);

    expect(useDocumentStore.getState().opened[documentId]).toMatchObject({
      content: "local",
      savedContent: "external",
      baseRevision: "r2",
      dirty: true,
      conflict: undefined,
    });

    store.reloadExternal(documentId, { ...opened, content: "disk", revision: "r3" });
    expect(useDocumentStore.getState().opened[documentId]).toMatchObject({
      content: "disk",
      dirty: false,
      baseRevision: "r3",
    });
  });

  it("migrates opened content without changing dirty state", () => {
    const store = useDocumentStore.getState();
    store.beginOpen(documentId, descriptor);
    store.finishOpen(documentId, opened);
    store.updateContent(documentId, "draft");
    const renamedId = asDocumentId("document:renamed");
    store.applyDocumentMappings([
      {
        oldPath: "notes.jsonc",
        newPath: "docs/notes.jsonc",
        oldDocumentId: documentId,
        newDocumentId: renamedId,
      },
    ]);

    expect(useDocumentStore.getState().opened[renamedId]).toMatchObject({
      documentId: renamedId,
      path: "docs/notes.jsonc",
      content: "draft",
      dirty: true,
    });
    expect(useDocumentStore.getState().opened[documentId]).toBeUndefined();
  });
});
