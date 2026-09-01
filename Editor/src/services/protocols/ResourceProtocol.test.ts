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
