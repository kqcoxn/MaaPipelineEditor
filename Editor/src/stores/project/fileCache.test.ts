import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FileType } from "./fileStore";
import {
  flushFileCache,
  readCachedFiles,
  resetFileCacheForTests,
  scheduleFileCache,
  setFileCacheErrorHandler,
} from "./fileCache";

function createFile(fileName: string, prefix = ""): FileType {
  return {
    fileName,
    nodes: [],
    edges: [],
    config: { prefix },
  };
}

describe("file cache", () => {
  beforeEach(() => {
    localStorage.clear();
    resetFileCacheForTests();
    vi.stubGlobal("indexedDB", undefined);
  });

  afterEach(() => {
    resetFileCacheForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("restores the legacy cache before the first IndexedDB migration", async () => {
    const files = [createFile("first"), createFile("second")];
    localStorage.setItem("_mpe_files", JSON.stringify(files));

    await expect(readCachedFiles()).resolves.toEqual({
      files,
      currentFileName: "first",
      source: "local",
      updatedAt: 0,
    });
  });

  it("writes only changed file records and preserves the current file", async () => {
    const first = createFile("first");
    const second = createFile("second");
    scheduleFileCache([first, second], "second");
    await flushFileCache();

    const setItem = vi.spyOn(localStorage, "setItem");
    const changedFirst = createFile("first", "changed");
    scheduleFileCache([changedFirst, second], "second");
    await flushFileCache();

    expect(setItem).toHaveBeenCalledTimes(2);
    expect(setItem).toHaveBeenCalledWith(
      "_mpe_file:first",
      expect.any(String),
    );
    expect(setItem).not.toHaveBeenCalledWith(
      "_mpe_file:second",
      expect.any(String),
    );
    await expect(readCachedFiles()).resolves.toMatchObject({
      currentFileName: "second",
      files: [
        { fileName: "first", config: { prefix: "changed" } },
        { fileName: "second" },
      ],
    });
  });

  it("removes records for closed files", async () => {
    const first = createFile("first");
    const second = createFile("second");
    scheduleFileCache([first, second], "first");
    await flushFileCache();
    expect(localStorage.getItem("_mpe_file:second")).not.toBeNull();

    scheduleFileCache([first], "first");
    await flushFileCache();

    expect(localStorage.getItem("_mpe_file:second")).toBeNull();
    await expect(readCachedFiles()).resolves.toMatchObject({
      files: [{ fileName: "first" }],
    });
  });

  it("preserves a file renamed back before the pending cache is flushed", async () => {
    const original = createFile("first", "original");
    scheduleFileCache([original], original.fileName);
    await flushFileCache();

    const renamed = createFile("first-edit", "renamed");
    scheduleFileCache([renamed], renamed.fileName);
    const restoredName = createFile("first", "restored");
    scheduleFileCache([restoredName], restoredName.fileName);
    await flushFileCache();

    await expect(readCachedFiles()).resolves.toMatchObject({
      currentFileName: "first",
      files: [{ fileName: "first", config: { prefix: "restored" } }],
    });
  });

  it("reports a fallback storage failure", async () => {
    const onError = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    setFileCacheErrorHandler(onError);
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });

    scheduleFileCache([createFile("first")], "first");
    await flushFileCache();

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toMatchObject({
      name: "QuotaExceededError",
    });
  });
});
