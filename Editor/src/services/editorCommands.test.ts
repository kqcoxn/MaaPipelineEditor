import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isEmbedEnvironment: vi.fn(() => false),
  sendToParent: vi.fn(),
  saveDocument: vi.fn(async () => true),
}));

vi.mock("../utils/embedBridge", () => ({
  isEmbedEnvironment: mocks.isEmbedEnvironment,
  sendToParent: mocks.sendToParent,
}));

vi.mock("./server", () => ({
  documentProtocol: { saveDocument: mocks.saveDocument },
}));

import type { FileType } from "../stores/fileStore";
import { useFileStore } from "../stores/fileStore";
import { useProjectSessionStore } from "../stores/projectSessionStore";
import { useToolbarStore } from "../stores/toolbarStore";
import { saveActiveEditor } from "./editorCommands";

const originalSaveFileToLocal = useFileStore.getState().saveFileToLocal;

function pipeline(path?: string): FileType {
  return {
    fileName: "main",
    nodes: [],
    edges: [],
    config: { prefix: "draft", filePath: path },
    saveState: {
      dirty: true,
      savedFingerprint: "baseline",
      saving: false,
    },
  };
}

describe("saveActiveEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isEmbedEnvironment.mockReturnValue(false);
    useProjectSessionStore.getState().clear();
    useToolbarStore.getState().closeExportDialog();
    useFileStore.getState().resetProjectSession();
    useFileStore.setState({ saveFileToLocal: originalSaveFileToLocal });
  });

  it("routes ordinary documents through document.save", async () => {
    useProjectSessionStore.getState().openDocument("notes.jsonc");

    await expect(saveActiveEditor()).resolves.toBe("saved");

    expect(mocks.saveDocument).toHaveBeenCalledWith("notes.jsonc");
  });

  it("routes project Pipelines through the local save command", async () => {
    const file = pipeline("pipeline/main.json");
    const saveFileToLocal = vi.fn(async () => true);
    useFileStore.setState({ files: [file], currentFile: file, saveFileToLocal });
    useProjectSessionStore.getState().openPipeline("pipeline/main.json");

    await expect(saveActiveEditor()).resolves.toBe("saved");

    expect(saveFileToLocal).toHaveBeenCalledWith(undefined, file, undefined, {
      allowOverwrite: false,
    });
  });

  it("opens ExportCopy for a pathless Pipeline draft", async () => {
    const file = pipeline();
    useFileStore.setState({ files: [file], currentFile: file });
    useProjectSessionStore.getState().openPipeline(file.fileName);

    await expect(saveActiveEditor()).resolves.toBe("export-requested");

    expect(useToolbarStore.getState().exportDialogOpen).toBe(true);
  });

  it("delegates embedded saves to the host", async () => {
    mocks.isEmbedEnvironment.mockReturnValue(true);

    await expect(saveActiveEditor()).resolves.toBe("delegated");

    expect(mocks.sendToParent).toHaveBeenCalledWith("mpe:saveRequest", {
      hint: "user-triggered",
    });
  });
});
