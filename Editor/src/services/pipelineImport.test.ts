import { beforeEach, describe, expect, it } from "vitest";

import { useFileStore } from "../stores/fileStore";
import {
  pipelineTabKey,
  useProjectSessionStore,
} from "../stores/projectSessionStore";
import { importPipelineAsDraft } from "./pipelineImport";

describe("importPipelineAsDraft", () => {
  beforeEach(() => {
    useFileStore.getState().resetProjectSession();
    useProjectSessionStore.getState().clear();
  });

  it("creates a pathless draft without changing the opened project Pipeline", async () => {
    await expect(
      useFileStore
        .getState()
        .openFileFromLocal("pipeline/original.json", '{"Original": {}}'),
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
      (file) => file.fileName === original.fileName,
    );
    expect(unchangedOriginal).toMatchObject({
      nodes: original.nodes,
      config: { filePath: "pipeline/original.json" },
    });
    expect(state.currentFile).toMatchObject({
      fileName: "imported",
      saveState: { dirty: true },
    });
    expect(state.currentFile.config.filePath).toBeUndefined();
    expect(useProjectSessionStore.getState().activeKey).toBe(
      pipelineTabKey(state.currentFile.fileName),
    );
  });
});
