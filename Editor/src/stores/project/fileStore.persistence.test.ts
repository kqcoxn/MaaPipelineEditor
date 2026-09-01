import type { NodeChange } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPipelineNode, useFlowStore } from "@/stores/flow";
import {
  flushFileCache,
  resetFileCacheForTests,
  scheduleFileCache,
} from "./fileCache";
import { useFileStore, type FileType } from "./fileStore";
import {
  initializeFileCachePersistence,
  restoreFileCache,
} from "./fileCachePersistence";

function initializeFile(): FileType {
  const node = createPipelineNode("node", {
    label: "Node",
    position: { x: 0, y: 0 },
  });
  const file: FileType = {
    fileName: "pipeline",
    nodes: [node],
    edges: [],
    config: { prefix: "" },
  };
  useFileStore.getState().replace([file], file.fileName);
  return file;
}

describe("file cache persistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("indexedDB", undefined);
    localStorage.clear();
    resetFileCacheForTests();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    resetFileCacheForTests();
  });

  it("ignores selection-only changes and persists a real graph revision", async () => {
    initializeFile();
    const dispose = initializeFileCachePersistence();
    await flushFileCache();
    const setItem = vi.spyOn(localStorage, "setItem");

    useFlowStore.getState().updateNodes([
      { type: "select", id: "node", selected: true } as NodeChange,
    ]);
    await vi.advanceTimersByTimeAsync(600);
    await flushFileCache();
    expect(setItem).not.toHaveBeenCalled();

    useFlowStore.getState().updateNodes([
      {
        type: "position",
        id: "node",
        position: { x: 120, y: 80 },
        dragging: false,
      } as NodeChange,
    ]);
    await vi.advanceTimersByTimeAsync(500);
    await flushFileCache();

    expect(setItem).toHaveBeenCalledWith(
      "_mpe_file:pipeline",
      expect.any(String),
    );
    const persisted = JSON.parse(
      localStorage.getItem("_mpe_file:pipeline") ?? "{}",
    ) as FileType;
    expect(persisted.nodes[0].position).toEqual({ x: 120, y: 80 });
    expect(persisted.nodes[0].selected).toBeUndefined();

    dispose();
  });

  it("commits the latest graph synchronously when the page is leaving", async () => {
    initializeFile();
    const dispose = initializeFileCachePersistence();
    await flushFileCache();

    useFlowStore.getState().updateNodes([
      {
        type: "position",
        id: "node",
        position: { x: 240, y: 160 },
        dragging: false,
      } as NodeChange,
    ]);
    window.dispatchEvent(new PageTransitionEvent("pagehide"));

    const persisted = JSON.parse(
      localStorage.getItem("_mpe_file:pipeline") ?? "{}",
    ) as FileType;
    expect(persisted.nodes[0].position).toEqual({ x: 240, y: 160 });

    dispose();
  });

  it("restores all files and the previously active file", async () => {
    const first = initializeFile();
    const second: FileType = {
      fileName: "second",
      nodes: [],
      edges: [],
      config: { prefix: "second" },
    };
    scheduleFileCache([first, second], second.fileName);
    await flushFileCache();
    resetFileCacheForTests();

    useFileStore.getState().replace([first], first.fileName);
    await expect(restoreFileCache()).resolves.toBe(true);

    expect(useFileStore.getState().files.map((file) => file.fileName)).toEqual([
      "pipeline",
      "second",
    ]);
    expect(useFileStore.getState().currentFile.fileName).toBe("second");
  });
});
