import { describe, it, expect } from "vitest";
import { fileSignature, hasUnsavedContent } from "./fileDirtyState";
import type { FileType } from "./fileStore";
describe("desktop file save baseline", () => {
  const file = (): FileType => ({
    fileName: "example",
    nodes: [],
    edges: [],
    config: { prefix: "", filePath: "/project/a.json" },
  });
  it("does not infer saved state from local cache or sync timestamp", () => {
    const f = file();
    f.config.lastSyncTime = Date.now();
    expect(hasUnsavedContent(f)).toBe(true);
  });
  it("tracks content and ignores sync metadata", () => {
    const f = file();
    f.config.savedContentSignature = fileSignature(f);
    f.config.lastSyncTime = Date.now();
    expect(hasUnsavedContent(f)).toBe(false);
    f.config.prefix = "new";
    expect(hasUnsavedContent(f)).toBe(true);
  });
  it("does not prompt for an empty new document", () => {
    const f = file();
    delete f.config.filePath;
    expect(hasUnsavedContent(f)).toBe(false);
  });
});
