import type { ReactFlowInstance } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPipelineNode, useFlowStore } from "@/stores/flow";
import { useFileStore, type FileType } from "./fileStore";
import { initializeFileCachePersistence } from "./fileCachePersistence";
import { resetFileCacheForTests } from "./fileCache";

vi.mock("@/stores/ui/processStore", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/stores/ui/processStore")>(),
  runWithProcess: async (_label: string, task: (update: () => void) => Promise<void>) => task(() => {}),
}));

const originalViewport = { x: -820, y: 310, zoom: 1.8 };
function file(name: string, viewport = originalViewport): FileType {
  return { fileName: name, nodes: [createPipelineNode("node", { label: "Start" })], edges: [],
    config: { prefix: "", filePath: `D:/test/${name}.json`, savedViewport: viewport } };
}

describe("文件视角恢复与重载", () => {
  let viewport = { ...originalViewport };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("indexedDB", undefined);
    localStorage.clear();
    resetFileCacheForTests();
    viewport = { ...originalViewport };
    useFlowStore.setState({ pendingViewport: null, viewport, instance: {
      viewportInitialized: true,
      getViewport: () => viewport,
      fitView: () => { viewport = { x: 0, y: 0, zoom: 1 }; return Promise.resolve(true); },
    } as ReactFlowInstance });
  });
  afterEach(() => {
    useFlowStore.setState({ instance: null, pendingViewport: null });
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    resetFileCacheForTests();
  });

  it("恢复缓存时保留视角请求，且不会被延迟居中覆盖", async () => {
    const current = file("a");
    useFlowStore.getState().replace(current.nodes, []);
    useFileStore.getState().replace([current], "a");
    await vi.advanceTimersByTimeAsync(200);
    expect(viewport).toEqual(originalViewport);
    expect(useFlowStore.getState().pendingViewport).toEqual(originalViewport);
  });

  it("快速切换只保留最后文件的恢复请求", () => {
    const secondViewport = { x: 90, y: -500, zoom: 0.6 };
    useFileStore.getState().replace([file("a"), file("b", secondViewport)], "a");
    useFileStore.getState().switchFile("b");
    expect(useFlowStore.getState().pendingViewport).toEqual(secondViewport);
    useFileStore.getState().switchFile("a");
    expect(useFlowStore.getState().pendingViewport).toEqual(originalViewport);
    expect(useFileStore.getState().files[1].config.savedViewport).toEqual(secondViewport);
  });

  it("无效的缓存视角回退到默认定位", async () => {
    useFileStore.getState().replace([file("a", { x: NaN, y: 0, zoom: -1 })], "a");
    await vi.advanceTimersByTimeAsync(200);
    expect(useFlowStore.getState().pendingViewport).toBeNull();
    expect(viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it.each([true, false])("重载更新内容但不移动镜头（带坐标：%s）", async (withPosition) => {
    useFileStore.getState().replace([file("a")], "a");
    useFlowStore.setState({ pendingViewport: null });
    const content = { Changed: { action: "DoNothing", ...(withPosition ? { $__mpe_code: { position: { x: 800, y: 500 } } } : {}) } };
    expect(await useFileStore.getState().openFileFromLocal("D:/test/a.json", content)).toBe(true);
    await vi.advanceTimersByTimeAsync(1500);
    expect(useFlowStore.getState().nodes.map((node) => node.data.label)).toEqual(["Changed"]);
    expect(viewport).toEqual(originalViewport);
  });

  it("页面离开时采集尚未触发移动结束事件的实时视角", () => {
    useFileStore.getState().replace([file("a")], "a");
    useFlowStore.setState({ pendingViewport: null });
    const dispose = initializeFileCachePersistence();
    viewport = { x: -999, y: 456, zoom: 2.1 };
    window.dispatchEvent(new PageTransitionEvent("pagehide"));
    expect(JSON.parse(localStorage.getItem("_mpe_file:a")!).config.savedViewport).toEqual(viewport);
    dispose();
  });
});
