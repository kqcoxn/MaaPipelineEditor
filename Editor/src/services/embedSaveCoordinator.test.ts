import { beforeEach, describe, expect, it } from "vitest";

import { syncCurrentPipelineToDocuments } from "../features/pipeline-document/pipelineDocumentService";
import { useDocumentStore } from "../stores/documentStore";
import { useFileStore } from "../stores/fileStore";
import {
  beginEmbedSave,
  clearPendingEmbedSaves,
  resolveEmbedSaveResult,
} from "./embedSaveCoordinator";

describe("embedSaveCoordinator", () => {
  beforeEach(() => {
    clearPendingEmbedSaves();
    useDocumentStore.getState().clearProject();
    useFileStore.getState().resetProjectSession();
    useFileStore.getState().addFile({ isSwitch: true });
    const file = useFileStore.getState().currentFile;
    useDocumentStore.getState().registerDraft(
      file.documentId,
      {
        path: "",
        name: file.fileName,
        kind: "pipeline",
        language: "json",
        mimeType: "application/json",
        size: 0,
        editable: true,
        previewable: true,
      },
      "",
      { saved: true },
    );
  });

  it("advances only the matching captured document baseline", async () => {
    useFileStore.getState().setFileConfig("prefix", "saving-version");
    const request = await beginEmbedSave();
    const documentId = useFileStore.getState().currentFile.documentId;
    const submittedText = request.data;
    useFileStore.getState().setFileConfig("prefix", "later-version");
    await syncCurrentPipelineToDocuments();

    expect(resolveEmbedSaveResult({ saveToken: "unknown", success: true })).toBe(false);
    expect(
      resolveEmbedSaveResult({ saveToken: request.saveToken, success: true }),
    ).toBe(true);
    expect(useDocumentStore.getState().opened[documentId]).toMatchObject({
      savedText: submittedText,
      dirty: true,
    });
  });

  it("does not advance the document baseline after failed host persistence", async () => {
    const documentId = useFileStore.getState().currentFile.documentId;
    const baseline = useDocumentStore.getState().opened[documentId].savedText;
    useFileStore.getState().setFileConfig("prefix", "draft");
    const request = await beginEmbedSave();

    expect(
      resolveEmbedSaveResult({ saveToken: request.saveToken, success: false }),
    ).toBe(false);
    expect(useDocumentStore.getState().opened[documentId]).toMatchObject({
      savedText: baseline,
      dirty: true,
    });
  });
});
