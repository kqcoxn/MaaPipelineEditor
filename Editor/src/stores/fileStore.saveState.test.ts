import { beforeEach, describe, expect, it, vi } from "vitest";

import { localServer } from "../services/server";
import { FileProtocol } from "../services/protocols/FileProtocol";
import { useConfigStore } from "./configStore";
import type { NodeType } from "./flow";
import { useFileStore } from "./fileStore";
import { createPipelineFingerprint } from "./pipelineSaveState";

const node = {
  id: "Start",
  type: "pipeline-node",
  data: { label: "Start" },
  position: { x: 0, y: 0 },
} as NodeType;

describe("fileStore Pipeline save state", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    useFileStore.getState().resetProjectSession();
    useFileStore.getState().addFile({ isSwitch: true });
    useFileStore.getState().markCurrentSaved();
    useConfigStore.getState().setConfig("configHandlingMode", "integrated");
  });

  it("returns to clean when graph edits are reverted to the baseline", () => {
    const store = useFileStore.getState();
    store.syncCurrentGraph([node], []);
    expect(useFileStore.getState().currentFile.saveState.dirty).toBe(true);

    useFileStore.getState().syncCurrentGraph([], []);
    expect(useFileStore.getState().currentFile.saveState.dirty).toBe(false);
  });

  it("keeps later edits dirty after an earlier save fingerprint is acknowledged", () => {
    const store = useFileStore.getState();
    store.syncCurrentGraph([node], []);
    const savingFile = useFileStore.getState().currentFile;
    const savedFingerprint = createPipelineFingerprint(savingFile);

    store.setFileConfig("prefix", "later-edit");
    store.markFileSaved(savingFile.fileName, savedFingerprint);

    expect(useFileStore.getState().currentFile.saveState).toMatchObject({
      dirty: true,
      savedFingerprint,
      saving: false,
    });
  });

  it("does not advance the baseline when a save request cannot be sent", async () => {
    const store = useFileStore.getState();
    store.setFileConfig("filePath", "pipeline/main.json");
    store.setFileConfig("prefix", "draft");
    const baseline = useFileStore.getState().currentFile.saveState.savedFingerprint;
    vi.spyOn(localServer, "isConnected").mockReturnValue(true);
    vi.spyOn(localServer, "send").mockReturnValue(false);

    await expect(store.saveFileToLocal()).resolves.toBe(false);

    expect(useFileStore.getState().currentFile.saveState).toMatchObject({
      dirty: true,
      savedFingerprint: baseline,
      saving: false,
    });
  });

  it("restores cached drafts without treating them as saved", () => {
    useFileStore.getState().setFileConfig("filePath", "pipeline/main.json");
    useFileStore.getState().setFileConfig("prefix", "cached-draft");
    localStorage.setItem(
      "_mpe_files",
      JSON.stringify(useFileStore.getState().files),
    );

    useFileStore.getState().resetProjectSession();
    expect(useFileStore.getState().replace()).toBeNull();

    expect(useFileStore.getState().currentFile).toMatchObject({
      config: { prefix: "cached-draft" },
      saveState: { dirty: true, savedFingerprint: "" },
    });
    expect(useFileStore.getState().currentFile.config.filePath).toBeUndefined();
  });

  it("blocks a conflicted save until overwrite is explicit", async () => {
    const store = useFileStore.getState();
    store.setFileConfig("filePath", "pipeline/main.json");
    store.markCurrentSaved();
    store.setFileConfig("prefix", "local-draft");
    store.markFileModified("pipeline/main.json");
    vi.spyOn(localServer, "isConnected").mockReturnValue(true);
    const send = vi.spyOn(localServer, "send").mockReturnValue(true);

    await expect(store.saveFileToLocal()).resolves.toBe(false);
    expect(send).not.toHaveBeenCalled();

    vi.spyOn(FileProtocol, "waitForSaveAck").mockResolvedValue(true);
    await expect(
      store.saveFileToLocal(undefined, undefined, undefined, {
        allowOverwrite: true,
      }),
    ).resolves.toBe(true);
    expect(useFileStore.getState().currentFile.saveState).toMatchObject({
      dirty: false,
      externalChange: undefined,
    });
  });
});
