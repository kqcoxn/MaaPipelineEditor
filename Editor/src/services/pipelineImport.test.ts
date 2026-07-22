import { beforeEach, describe, expect, it } from "vitest";

import { asDocumentId } from "../features/project-session/types";
import { useFileStore } from "../stores/fileStore";
import { useDocumentStore } from "../stores/documentStore";
import { useProjectSessionStore } from "../stores/projectSessionStore";
import { usePipelineDocumentStore } from "../features/pipeline-document/pipelineDocumentStore";
import { importPipelineAsDraft } from "./pipelineImport";

describe("importPipelineAsDraft", () => {
  beforeEach(() => {
    useFileStore.getState().resetProjectSession();
    useDocumentStore.getState().clearProject();
    useProjectSessionStore.getState().clear();
    usePipelineDocumentStore.getState().clear();
  });

  it("creates a pathless draft without changing the opened project Pipeline", async () => {
    const originalDocumentId = asDocumentId("document:original");
    await expect(
      useFileStore
        .getState()
        .openFileFromLocal(
          "pipeline/original.json",
          '{"Original": {}}',
          undefined,
          undefined,
          originalDocumentId,
        ),
    ).resolves.toBe(true);
    const original = useFileStore.getState().currentFile;

    await expect(
      importPipelineAsDraft({
        content: '{"Imported": {}}',
        suggestedName: "imported.json",
      }),
    ).resolves.toBe(true);

    const state = useFileStore.getState();
    const unchangedOriginal = state.files.find(
      (file) => file.documentId === originalDocumentId,
    );
    expect(unchangedOriginal).toMatchObject({
      documentId: originalDocumentId,
      nodes: original.nodes,
      config: { filePath: "pipeline/original.json" },
    });
    expect(state.currentFile).toMatchObject({
      fileName: "imported",
    });
    expect(state.currentFile.documentId).not.toBe(originalDocumentId);
    expect(state.currentFile.documentId).toMatch(/^draft:/);
    expect(state.currentFile.config.filePath).toBeUndefined();
    expect(useProjectSessionStore.getState().activeDocumentId).toBe(
      state.currentFile.documentId,
    );
    expect(
      useDocumentStore.getState().opened[state.currentFile.documentId],
    ).toMatchObject({
      descriptor: { kind: "pipeline" },
      dirty: true,
    });
  });

  it("keeps an invalid JSONC import as a source-editable draft", async () => {
    const source = '// fix me\n{"Start": }\n';

    await expect(
      importPipelineAsDraft({ content: source, suggestedName: "broken.jsonc" }),
    ).resolves.toBe(true);

    const current = useFileStore.getState().currentFile;
    expect(useDocumentStore.getState().opened[current.documentId]).toMatchObject({
      workingText: source,
      dirty: true,
      descriptor: { name: "broken.jsonc", language: "jsonc" },
    });
    expect(usePipelineDocumentStore.getState().documents[current.documentId]).toMatchObject({
      viewMode: "source",
      parseState: "invalid",
    });
  });
});
