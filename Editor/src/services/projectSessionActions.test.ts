import { Modal } from "antd";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    const path = "pipeline/main.json";
    useFileStore.getState().addFile({ isSwitch: true });
    useFileStore.getState().setFileConfig("filePath", path);
    useFileStore.getState().markCurrentSaved();
    useFileStore.getState().setFileConfig("prefix", "draft");
    useProjectSessionStore.getState().openPipeline(path);
    const tab = useProjectSessionStore.getState().tabs[0];
    vi.spyOn(Modal, "confirm").mockImplementation((options) => {
      options.onCancel?.();
      return { destroy: vi.fn(), update: vi.fn() } as never;
    });

    await expect(closeEditorTab(tab)).resolves.toBe(false);

    expect(useProjectSessionStore.getState().tabs).toHaveLength(1);
    expect(useFileStore.getState().files).toHaveLength(1);
  });

  it("closes a pipeline tab even when its file is no longer loaded", async () => {
    const path = "C:/project/missing.json";
    const session = useProjectSessionStore.getState();
    session.openPipeline(path);
    const tab = useProjectSessionStore.getState().tabs[0];

    await expect(closeEditorTab(tab)).resolves.toBe(true);
    expect(useProjectSessionStore.getState().tabs).toEqual([]);
  });

  it("closes the last loaded pipeline without creating a replacement", async () => {
    const path = "pipeline/main.json";
    const fileStore = useFileStore.getState();
    const fileName = fileStore.addFile({ isSwitch: true });
    expect(fileName).not.toBeNull();
    fileStore.setFileConfig("filePath", path);
    useProjectSessionStore.getState().openPipeline(path);
    const tab = useProjectSessionStore.getState().tabs[0];

    await closeEditorTab(tab);

    expect(useProjectSessionStore.getState().tabs).toEqual([]);
    expect(useFileStore.getState().files).toEqual([]);
    expect(useFileStore.getState().currentFile.config.filePath).toBeUndefined();
  });
});
