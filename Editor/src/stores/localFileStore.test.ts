import { beforeEach, describe, expect, it } from "vitest";

import {
  useLocalFileStore,
  type LocalFileInfo,
} from "./localFileStore";

const pendingFile: LocalFileInfo = {
  file_path: "project/resource/pipeline/main.json",
  file_name: "main.json",
  relative_path: "project/resource/pipeline/main.json",
  nodes: [],
  prefix: "",
  index_status: "pending",
  is_default_pipeline: false,
};

describe("localFileStore workspace revisions", () => {
  beforeEach(() => useLocalFileStore.getState().clear());

  it("merges index summaries for the current revision", () => {
    useLocalFileStore
      .getState()
      .setFileList(7, "C:/project", "interface.json", [pendingFile], []);
    useLocalFileStore.getState().applyIndexUpdate(7, [
      {
        ...pendingFile,
        nodes: [{ label: "Start", prefix: "", anchors: ["Entry"] }],
        index_status: "ready",
      },
    ]);

    expect(useLocalFileStore.getState().files[0]).toMatchObject({
      index_status: "ready",
      nodes: [{ label: "Start", prefix: "", anchors: ["Entry"] }],
    });
  });

  it("discards file lists and index updates from older revisions", () => {
    useLocalFileStore
      .getState()
      .setFileList(7, "C:/project", "interface.json", [pendingFile], []);
    useLocalFileStore.getState().applyIndexUpdate(6, [
      { ...pendingFile, index_status: "ready" },
    ]);
    useLocalFileStore
      .getState()
      .setFileList(6, "C:/old", "old/interface.json", [], []);

    expect(useLocalFileStore.getState()).toMatchObject({
      revision: 7,
      rootPath: "C:/project",
      files: [pendingFile],
    });
  });
});
