import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalWebSocketServer } from "../server";
import { useLocalFileStore } from "@/stores/project/localFileStore";
import { ResourceProtocol } from "./ResourceProtocol";

type RouteHandler = (data: unknown) => void;

class FakeWebSocketServer {
  readonly sent: Array<{ path: string; data: Record<string, unknown> }> = [];
  private readonly routes = new Map<string, RouteHandler>();
  private readonly statusHandlers = new Set<(connected: boolean) => void>();

  registerRoute(path: string, handler: RouteHandler): void {
    this.routes.set(path, handler);
  }

  onStatus(handler: (connected: boolean) => void): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  send(path: string, data: Record<string, unknown>): boolean {
    this.sent.push({ path, data });
    return true;
  }

  deliver(path: string, data: Record<string, unknown>): void {
    this.routes.get(path)?.(data);
  }

  emitStatus(connected: boolean): void {
    this.statusHandlers.forEach((handler) => handler(connected));
  }
}

describe("ResourceProtocol image requests", () => {
  let protocol: ResourceProtocol;
  let server: FakeWebSocketServer;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:a")
      .mockReturnValueOnce("blob:b");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    useLocalFileStore.getState().clear();
    server = new FakeWebSocketServer();
    protocol = new ResourceProtocol();
    protocol.register(server as unknown as LocalWebSocketServer);
  });

  afterEach(() => {
    protocol.unregister();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("去重批量请求并用一次 Store 更新提交响应", async () => {
    protocol.requestImages(["a.png", "a.png", "b.png"]);
    await vi.advanceTimersByTimeAsync(50);

    expect(server.sent).toHaveLength(1);
    expect(server.sent[0]).toMatchObject({
      path: "/etl/get_images",
      data: { relative_paths: ["a.png", "b.png"] },
    });

    const imageCacheUpdates = vi.fn();
    const unsubscribe = useLocalFileStore.subscribe(
      (state) => state.imageCache,
      imageCacheUpdates,
    );
    server.deliver("/lte/images", {
      request_id: server.sent[0].data.request_id,
      images: [
        {
          success: true,
          relative_path: "a.png",
          base64: btoa("a"),
          mime_type: "image/png",
          width: 20,
          height: 10,
        },
        {
          success: true,
          relative_path: "b.png",
          base64: btoa("b"),
          mime_type: "image/png",
          width: 30,
          height: 15,
        },
      ],
    });

    expect(imageCacheUpdates).toHaveBeenCalledTimes(1);
    expect(useLocalFileStore.getState().imageCache.size).toBe(2);
    expect(useLocalFileStore.getState().pendingImageRequests.size).toBe(0);
    expect(useLocalFileStore.getState().getImageCache("a.png")?.dataUrl).toBe(
      "data:image/png;base64,YQ==",
    );
    unsubscribe();

    server.emitStatus(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:a");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:b");
  });

  it("项目切换后忽略旧批次响应", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    useLocalFileStore.getState().setFileList("/project-a", [], []);
    protocol.requestImage("old.png");
    await vi.advanceTimersByTimeAsync(50);
    const oldRequestId = server.sent[0].data.request_id;

    useLocalFileStore.getState().setFileList("/project-b", [], []);
    server.deliver("/lte/images", {
      request_id: oldRequestId,
      images: [
        {
          success: true,
          relative_path: "old.png",
          base64: btoa("old"),
        },
      ],
    });

    expect(useLocalFileStore.getState().imageCache.size).toBe(0);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalled();
  });

  it("资源包列表更新不会取消活动图片批次", async () => {
    protocol.requestImage("a.png");
    await vi.advanceTimersByTimeAsync(50);
    const requestId = server.sent[0].data.request_id;

    server.deliver("/lte/resource_bundles", {
      root: "/project",
      bundles: [],
      image_dirs: [],
    });
    server.deliver("/lte/images", {
      request_id: requestId,
      images: [
        {
          success: true,
          relative_path: "a.png",
          base64: btoa("a"),
        },
      ],
    });

    expect(useLocalFileStore.getState().getImageCache("a.png")).toBeDefined();
    expect(useLocalFileStore.getState().pendingImageRequests.size).toBe(0);
  });

  it("同名图片文件变化时替换已有缓存", () => {
    useLocalFileStore.getState().setImageCache("menu.png", {
      blob: new Blob(["old"], { type: "image/png" }),
      url: "blob:old",
      dataUrl: "data:image/png;base64,b2xk",
      mimeType: "image/png",
      width: 10,
      height: 10,
      bundleName: "base",
      absPath: "/project/image/menu.png",
      timestamp: 1,
    });

    server.deliver("/lte/image_changed", {
      type: "modified",
      success: true,
      relative_path: "menu.png",
      absolute_path: "/project/image/menu.png",
      bundle_name: "base",
      base64: btoa("new"),
      mime_type: "image/png",
      width: 20,
      height: 15,
    });

    const image = useLocalFileStore.getState().getImageCache("menu.png");
    expect(image?.dataUrl).toBe("data:image/png;base64,bmV3");
    expect(image).toMatchObject({ width: 20, height: 15 });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:old");
  });

  it("图片删除后移除已有缓存", () => {
    useLocalFileStore.getState().setImageCache("menu.png", {
      blob: new Blob(["old"], { type: "image/png" }),
      url: "blob:old",
      dataUrl: "data:image/png;base64,b2xk",
      mimeType: "image/png",
      width: 10,
      height: 10,
      bundleName: "base",
      absPath: "/project/image/menu.png",
      timestamp: 1,
    });

    server.deliver("/lte/image_changed", {
      type: "deleted",
      success: false,
      relative_path: "menu.png",
      message: "图片未找到",
    });

    expect(useLocalFileStore.getState().getImageCache("menu.png")).toBeUndefined();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:old");
  });

  it("不完整响应也会结束整批 pending", async () => {
    protocol.requestImages(["a.png", "missing.png"]);
    await vi.advanceTimersByTimeAsync(50);

    server.deliver("/lte/images", {
      request_id: server.sent[0].data.request_id,
      images: [
        {
          success: true,
          relative_path: "a.png",
          base64: btoa("a"),
        },
      ],
    });

    expect(useLocalFileStore.getState().pendingImageRequests.size).toBe(0);
  });
});
