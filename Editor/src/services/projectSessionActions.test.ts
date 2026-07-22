import { Modal } from "antd";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { asDocumentId } from "../features/project-session/types";
import { useFileStore } from "../stores/fileStore";
import { useProjectSessionStore } from "../stores/projectSessionStore";
import { closeEditorTab } from "./projectSessionActions";

describe("projectSessionActions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useProjectSessionStore.getState().clear();
    useFileStore.getState().resetProjectSession();
  });

  it("keeps a dirty Pipeline tab open when the user continues editing", async () => {
    useFileStore.getState().addFile({ isSwitch: true });
    useFileStore.getState().markCurrentSaved();
    useFileStore.getState().setFileConfig("prefix", "draft");
    const documentId = useFileStore.getState().currentFile.documentId;
    useProjectSessionStore.getState().openDocument(documentId);
    const tab = { documentId };
    vi.spyOn(Modal, "confirm").mockImplementation((options) => {
      options.onCancel?.();
      return { destroy: vi.fn(), update: vi.fn() } as never;
    });

    await expect(closeEditorTab(tab)).resolves.toBe(false);

    expect(useProjectSessionStore.getState().tabs).toEqual([tab]);
    expect(useFileStore.getState().files).toHaveLength(1);
  });

  it("closes a Pipeline tab even when its file is no longer loaded", async () => {
    const documentId = asDocumentId("draft:missing");
    const session = useProjectSessionStore.getState();
    session.registerDraft("missing", "pipeline", documentId);
    session.openDocument(documentId);
    const tab = { documentId };

    await expect(closeEditorTab(tab)).resolves.toBe(true);
    expect(useProjectSessionStore.getState().tabs).toEqual([]);
  });

  it("closes the last loaded Pipeline without creating a replacement", async () => {
    const fileStore = useFileStore.getState();
    const fileName = fileStore.addFile({ isSwitch: true });
    expect(fileName).not.toBeNull();
    const documentId = useFileStore.getState().currentFile.documentId;
    useProjectSessionStore.getState().openDocument(documentId);
    const tab = { documentId };

    await closeEditorTab(tab);

    expect(useProjectSessionStore.getState().tabs).toEqual([]);
    expect(useFileStore.getState().files).toEqual([]);
    expect(useFileStore.getState().currentFile.config.filePath).toBeUndefined();
  });
});
