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
  encoding: "utf-8" as const,
};

describe("documentStore", () => {
  beforeEach(() => useDocumentStore.getState().clearProject());

  it("moves only the submitted snapshot baseline when editing continues during save", () => {
    const store = useDocumentStore.getState();
    store.beginOpen(documentId, descriptor);
    store.finishOpen(documentId, opened);
    store.updateWorkingText(documentId, '{"a":1}');
    const submittedText = useDocumentStore.getState().opened[documentId].workingText;
    store.setSaving(documentId, true);
    store.updateWorkingText(documentId, '{"a":2}');
    store.markSaved(
      documentId,
      {
        path: descriptor.path,
        revision: "r2",
        size: submittedText.length,
        sha256: "r2",
        operationId: "save:1",
        encoding: "utf-8",
      },
      submittedText,
    );

    expect(useDocumentStore.getState().opened[documentId]).toMatchObject({
      savedText: '{"a":1}',
      workingText: '{"a":2}',
      dirty: true,
      savedRevision: "r2",
      saving: false,
    });
    expect(getDirtyDocumentIds()).toEqual([documentId]);
  });

  it("retains local text and external encoding when resolving a conflict", () => {
    const store = useDocumentStore.getState();
    store.beginOpen(documentId, descriptor);
    store.finishOpen(documentId, opened);
    store.updateWorkingText(documentId, "local");
    store.setConflict(documentId, {
      ...opened,
      content: "external",
      revision: "r2",
      encoding: "utf-8-bom",
    });

    expect(useDocumentStore.getState().opened[documentId].conflict).toEqual({
      externalText: "external",
      externalRevision: "r2",
      externalEncoding: "utf-8-bom",
    });

    store.keepLocal(documentId);
    expect(useDocumentStore.getState().opened[documentId]).toMatchObject({
      workingText: "local",
      savedText: "external",
      savedRevision: "r2",
      encoding: "utf-8-bom",
      dirty: true,
      conflict: undefined,
    });

    store.reloadExternal(documentId, { ...opened, content: "disk", revision: "r3" });
    expect(useDocumentStore.getState().opened[documentId]).toMatchObject({
      workingText: "disk",
      savedText: "disk",
      dirty: false,
      savedRevision: "r3",
    });
  });

  it("ignores conflict notifications for the saved revision", () => {
    const store = useDocumentStore.getState();
    store.beginOpen(documentId, descriptor);
    store.finishOpen(documentId, opened);
    store.updateWorkingText(documentId, "local");
    store.setConflict(documentId, { ...opened, content: "duplicate" });

    expect(useDocumentStore.getState().opened[documentId].conflict).toBeUndefined();
  });

  it("retains an externally deleted document as a dirty local draft", () => {
    const store = useDocumentStore.getState();
    store.beginOpen(documentId, descriptor);
    store.finishOpen(documentId, opened);

    store.markDeleted(documentId);

    expect(useDocumentStore.getState().opened[documentId]).toMatchObject({
      workingText: "{}",
      deleted: true,
      dirty: true,
    });
    expect(getDirtyDocumentIds()).toEqual([documentId]);
  });

  it("migrates opened documents and linked ids without changing dirty state", () => {
    const store = useDocumentStore.getState();
    const linkedId = asDocumentId("document:sidecar");
    store.beginOpen(documentId, descriptor);
    store.finishOpen(documentId, opened);
    store.updateWorkingText(documentId, "draft");
    store.setLinkedDocuments(documentId, [linkedId]);
    const renamedId = asDocumentId("document:renamed");
    const renamedLinkedId = asDocumentId("document:renamed-sidecar");
    store.applyDocumentMappings([
      {
        oldPath: "notes.jsonc",
        newPath: "docs/notes.jsonc",
        oldDocumentId: documentId,
        newDocumentId: renamedId,
      },
      {
        oldPath: ".notes.mpe.json",
        newPath: "docs/.notes.mpe.json",
        oldDocumentId: linkedId,
        newDocumentId: renamedLinkedId,
      },
    ]);

    expect(useDocumentStore.getState().opened[renamedId]).toMatchObject({
      documentId: renamedId,
      path: "docs/notes.jsonc",
      workingText: "draft",
      dirty: true,
      linkedDocumentIds: [renamedLinkedId],
    });
    expect(useDocumentStore.getState().opened[documentId]).toBeUndefined();
  });
});
