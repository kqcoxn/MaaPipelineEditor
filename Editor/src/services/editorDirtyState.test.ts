import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFileStore } from "../stores/fileStore";
import { useDocumentStore } from "../stores/documentStore";
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
    useFileStore.getState().addFile({ isSwitch: true });
    useFileStore.getState().setFileConfig("prefix", "draft");
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
