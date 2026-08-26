import { describe, expect, it } from "vitest";
import {
  isDebugEntryAvailable,
  makeDebugResourceKey,
} from "./debugRunProfileStore";

const snapshot = {
  generatedAt: "2026-08-23T00:00:00.000Z",
  rootFileId: "main.json",
  nodes: [
    {
      fileId: "main.json",
      nodeId: "node-current",
      runtimeName: "Main_Start",
      displayName: "Start",
    },
  ],
  edges: [],
};

describe("debug profile entry recovery", () => {
  it("accepts a persisted entry that still exists in the current snapshot", () => {
    expect(
      isDebugEntryAvailable(
        {
          fileId: "main.json",
          nodeId: "node-current",
          runtimeName: "Main_Start",
        },
        snapshot,
      ),
    ).toBe(true);
  });

  it("rejects an entry whose node id or runtime name is stale", () => {
    expect(
      isDebugEntryAvailable(
        {
          fileId: "main.json",
          nodeId: "node-old",
          runtimeName: "Main_Start",
        },
        snapshot,
      ),
    ).toBe(false);
    expect(
      isDebugEntryAvailable(
        {
          fileId: "main.json",
          nodeId: "node-current",
          runtimeName: "Old_Start",
        },
        snapshot,
      ),
    ).toBe(false);
  });
});

describe("debug resource cache key", () => {
  it("changes when a pipeline file content hash changes", () => {
    const file = {
      file_path: "C:/resource/pipeline/main.json",
      file_name: "main.json",
      relative_path: "pipeline/main.json",
      nodes: [],
      prefix: "",
      content_hash: "before",
    };
    const before = makeDebugResourceKey(["C:/resource"], [], [file]);
    const after = makeDebugResourceKey(["C:/resource"], [], [
      { ...file, content_hash: "after" },
    ]);

    expect(after).not.toBe(before);
  });
});
