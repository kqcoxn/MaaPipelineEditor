import { beforeEach, describe, expect, it, vi } from "vitest";
import { shallow } from "zustand/shallow";
import { selectImageResourceValues } from "./imageCacheSelectors";
import {
  useLocalFileStore,
  type ImageCacheItem,
} from "./localFileStore";

function createCacheItem(url: string): ImageCacheItem {
  return {
    blob: new Blob([url], { type: "image/png" }),
    url,
    mimeType: "image/png",
    width: 40,
    height: 30,
    bundleName: "test",
    absPath: `/test/${url}`,
    timestamp: 1,
  };
}

describe("localFileStore image cache", () => {
  beforeEach(() => {
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    useLocalFileStore.getState().clear();
  });

  it("只通知引用已更新路径的 selector", () => {
    const paths = Array.from(
      { length: 40 },
      (_, index) =>
        `templates/perf-template-${String(index % 10).padStart(2, "0")}.png`,
    );
    let legacyNotifications = 0;
    let pathNotifications = 0;
    const unsubscribes: Array<() => void> = [];

    for (const path of paths) {
      unsubscribes.push(
        useLocalFileStore.subscribe(
          (state) => state.imageCache,
          () => {
            legacyNotifications += 1;
          },
        ),
      );
      unsubscribes.push(
        useLocalFileStore.subscribe(
          (state) => selectImageResourceValues(state, [path]),
          () => {
            pathNotifications += 1;
          },
          { equalityFn: shallow },
        ),
      );
    }

    useLocalFileStore
      .getState()
      .setImageCache("templates/perf-template-00.png", createCacheItem("blob:0"));
    unsubscribes.forEach((unsubscribe) => unsubscribe());

    expect(legacyNotifications).toBe(40);
    expect(pathNotifications).toBe(4);
    console.info(
      `[PERF-007] large image update notifications: ${legacyNotifications}->${pathNotifications}`,
    );
  });

  it("批量响应只更新一次并统一结束 pending", () => {
    const storeNotifications = vi.fn();
    const unsubscribe = useLocalFileStore.subscribe(storeNotifications);
    const store = useLocalFileStore.getState();
    store.setPendingImageRequests(["a.png", "b.png"], true);
    storeNotifications.mockClear();

    store.setImageCaches(
      [["a.png", createCacheItem("blob:a")]],
      ["a.png", "b.png"],
    );

    expect(storeNotifications).toHaveBeenCalledTimes(1);
    expect(useLocalFileStore.getState().getImageCache("a.png")?.url).toBe(
      "blob:a",
    );
    expect(useLocalFileStore.getState().pendingImageRequests.size).toBe(0);
    unsubscribe();
  });

  it("替换缓存、切换项目和清空时回收 Object URL", () => {
    const revokeObjectUrl = vi.mocked(URL.revokeObjectURL);
    const store = useLocalFileStore.getState();
    store.setFileList("/project-a", [], []);
    store.setImageCache("a.png", createCacheItem("blob:old"));
    store.setImageCache("a.png", createCacheItem("blob:new"));

    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:old");

    useLocalFileStore.getState().setFileList("/project-b", [], []);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:new");
    expect(useLocalFileStore.getState().imageCache.size).toBe(0);
  });
});
