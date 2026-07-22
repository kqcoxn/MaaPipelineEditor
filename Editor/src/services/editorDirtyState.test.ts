import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFileStore } from "../stores/fileStore";
import { useDocumentStore } from "../stores/documentStore";
import { asDocumentId } from "../features/project-session/types";
import { collectDirtyEditorItems, handleDirtyBeforeUnload } from "./editorDirtyState";

describe("editorDirtyState", () => {
  beforeEach(() => {
    useFileStore.getState().resetProjectSession();
    useDocumentStore.getState().clearProject();
  });

  it("does not block browser close when every editor item is clean", () => {
    const event = {
      preventDefault: vi.fn(),
      returnValue: undefined,
    } as unknown as BeforeUnloadEvent;

    handleDirtyBeforeUnload(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("blocks browser close and reports dirty Pipeline drafts", () => {
    const documentId = asDocumentId("draft:pipeline");
    useDocumentStore.getState().registerDraft(
      documentId,
      {
        path: "",
        name: "draft",
        kind: "pipeline",
        language: "json",
        mimeType: "application/json",
        size: 2,
        editable: true,
        previewable: true,
      },
      "{}",
    );
    const event = {
      preventDefault: vi.fn(),
      returnValue: undefined,
    } as unknown as BeforeUnloadEvent;

    handleDirtyBeforeUnload(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.returnValue).toBe("");
    expect(collectDirtyEditorItems()).toHaveLength(1);
  });
});
