import { beforeEach, describe, expect, it } from "vitest";

import { useFileStore } from "../stores/fileStore";
import {
  beginEmbedSave,
  clearPendingEmbedSaves,
  resolveEmbedSaveResult,
} from "./embedSaveCoordinator";

describe("embedSaveCoordinator", () => {
  beforeEach(() => {
    clearPendingEmbedSaves();
    useFileStore.getState().resetProjectSession();
    useFileStore.getState().addFile({ isSwitch: true });
    useFileStore.getState().markCurrentSaved();
  });

  it("advances only the matching captured baseline", () => {
    useFileStore.getState().setFileConfig("prefix", "saving-version");
    const request = beginEmbedSave();
    useFileStore.getState().setFileConfig("prefix", "later-version");

    expect(
      resolveEmbedSaveResult({ saveToken: "unknown", success: true }),
    ).toBe(false);
    expect(
      resolveEmbedSaveResult({ saveToken: request.saveToken, success: true }),
    ).toBe(true);
    expect(useFileStore.getState().currentFile.saveState.dirty).toBe(true);
  });

  it("does not advance the baseline after a failed host persistence", () => {
    useFileStore.getState().setFileConfig("prefix", "draft");
    const baseline = useFileStore.getState().currentFile.saveState.savedFingerprint;
    const request = beginEmbedSave();

    expect(
      resolveEmbedSaveResult({ saveToken: request.saveToken, success: false }),
    ).toBe(false);
    expect(useFileStore.getState().currentFile.saveState).toMatchObject({
      dirty: true,
      savedFingerprint: baseline,
    });
  });
});
