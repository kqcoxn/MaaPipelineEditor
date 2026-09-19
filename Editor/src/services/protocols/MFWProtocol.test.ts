import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMFWStore } from "@/stores/connection/mfwStore";
import type { LocalWebSocketServer } from "../server";
import { MFWProtocol } from "./MFWProtocol";

type RouteHandler = (data: unknown) => void;

class FakeWebSocketServer {
  private readonly statusListeners = new Set<(connected: boolean) => void>();
  readonly routes = new Map<string, RouteHandler>();
  readonly sent: Array<{ path: string; data: unknown }> = [];
  sendResult = true;

  get statusListenerCount(): number {
    return this.statusListeners.size;
  }

  onStatus(listener: (connected: boolean) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  registerRoute(path: string, handler: RouteHandler): void {
    this.routes.set(path, handler);
  }

  send(path: string, data: unknown): boolean {
    this.sent.push({ path, data });
    return this.sendResult;
  }

  emit(path: string, data: unknown): void {
    this.routes.get(path)?.(data);
  }
}

describe("MFWProtocol", () => {
  beforeEach(() => {
    useMFWStore.getState().clearConnection();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    useMFWStore.getState().clearConnection();
  });

  it("replaces and cleans up its LocalBridge status subscription", () => {
    const protocol = new MFWProtocol();
    const firstServer = new FakeWebSocketServer();
    const secondServer = new FakeWebSocketServer();

    protocol.register(firstServer as unknown as LocalWebSocketServer);
    expect(firstServer.statusListenerCount).toBe(1);

    protocol.register(secondServer as unknown as LocalWebSocketServer);
    expect(firstServer.statusListenerCount).toBe(0);
    expect(secondServer.statusListenerCount).toBe(1);

    protocol.unregister();
    expect(secondServer.statusListenerCount).toBe(0);
  });

  it("sends macOS window_id and clears connecting state when the request fails", () => {
    const protocol = new MFWProtocol();
    const server = new FakeWebSocketServer();
    server.sendResult = false;
    protocol.register(server as unknown as LocalWebSocketServer);

    expect(
      protocol.createMacosController({
        window_id: "0x2a",
        screencap_method: "ScreenCaptureKit",
        input_method: "GlobalEvent",
      }),
    ).toBe(false);
    expect(server.sent[0]).toEqual({
      path: "/etl/mfw/create_macos_controller",
      data: {
        window_id: "0x2a",
        screencap_method: "ScreenCaptureKit",
        input_method: "GlobalEvent",
      },
    });
    expect(useMFWStore.getState().connectionStatus).toBe("failed");
    protocol.unregister();
  });

  it("returns to failed after a controller connection timeout", () => {
    const protocol = new MFWProtocol();
    const server = new FakeWebSocketServer();
    protocol.register(server as unknown as LocalWebSocketServer);

    expect(
      protocol.createMacosController({
        window_id: "42",
        screencap_method: "ScreenCaptureKit",
        input_method: "GlobalEvent",
      }),
    ).toBe(true);
    expect(useMFWStore.getState().connectionStatus).toBe("connecting");

    vi.advanceTimersByTime(12_000);
    expect(useMFWStore.getState().connectionStatus).toBe("failed");
    expect(useMFWStore.getState().errorMessage).toContain("超时");
    protocol.unregister();
  });

  it("clears the timeout when controller_created arrives", () => {
    const protocol = new MFWProtocol();
    const server = new FakeWebSocketServer();
    protocol.register(server as unknown as LocalWebSocketServer);

    protocol.createMacosController({
      window_id: "42",
      screencap_method: "ScreenCaptureKit",
      input_method: "GlobalEvent",
    });
    server.emit("/lte/mfw/controller_created", {
      success: true,
      controller_id: "controller-1",
      type: "macos",
    });
    expect(useMFWStore.getState().connectionStatus).toBe("connected");

    vi.advanceTimersByTime(12_000);
    expect(useMFWStore.getState().connectionStatus).toBe("connected");
    protocol.unregister();
  });
  it("only records applied parameters after successful connection", () => {
    const protocol = new MFWProtocol();
    const server = new FakeWebSocketServer();
    protocol.register(server as unknown as LocalWebSocketServer);
    const request = { type: "win32" as const, params: { hwnd: "42", screencap_method: "FramePool", input_method: "Seize", keyboard_method: "Seize" } };
    protocol.connectController(request);
    expect(useMFWStore.getState().appliedConnection).toBeNull();
    server.emit("/lte/mfw/controller_created", { success: true, controller_id: "old", type: "win32" });
    expect(useMFWStore.getState().appliedConnection?.params).toEqual(request.params);
    expect(JSON.parse(localStorage.getItem("mpe_last_controller")!).params).toEqual(request.params);
    protocol.unregister();
  });

  it("waits for the matching disconnection acknowledgement before reconnecting", async () => {
    const protocol = new MFWProtocol();
    const server = new FakeWebSocketServer();
    protocol.register(server as unknown as LocalWebSocketServer);
    useMFWStore.getState().setControllerInfo("win32", "old", {});
    const replacement = { type: "win32" as const, params: { hwnd: "42", screencap_method: "FramePool", input_method: "Seize", keyboard_method: "Seize" } };
    const reconnect = protocol.disconnectControllerAndWait("old").then(() => protocol.connectController(replacement));
    vi.advanceTimersByTime(1000);
    server.emit("/lte/mfw/controller_status", { controller_id: "unrelated", connected: false });
    await Promise.resolve();
    expect(server.sent).toHaveLength(1);
    expect(useMFWStore.getState().controllerId).toBe("old");
    server.emit("/lte/mfw/controller_status", { controller_id: "old", connected: false });
    await reconnect;
    expect(server.sent[1]).toEqual({ path: "/etl/mfw/create_win32_controller", data: replacement.params });
    server.emit("/lte/mfw/controller_created", { success: true, controller_id: "new", type: "win32" });
    server.emit("/lte/mfw/controller_status", { controller_id: "old", connected: false });
    expect(useMFWStore.getState().controllerId).toBe("new");
    protocol.unregister();
  });

  it("preserves a busy controller and stops replacement on rejection", async () => {
    const protocol = new MFWProtocol();
    const server = new FakeWebSocketServer();
    protocol.register(server as unknown as LocalWebSocketServer);
    useMFWStore.getState().setControllerInfo("win32", "old", {});
    const promise = protocol.disconnectControllerAndWait("old");
    const rejected = expect(promise).rejects.toThrow("设备正在运行");
    server.emit("/lte/mfw/controller_status", { controller_id: "old", error: "设备正在运行，请先停止任务" });
    await rejected;
    expect(useMFWStore.getState().controllerId).toBe("old");
    expect(useMFWStore.getState().connectionStatus).toBe("connected");
    expect(server.sent).toHaveLength(1);
    protocol.unregister();
  });

  it("times out disconnection without dropping the current controller", async () => {
    const protocol = new MFWProtocol();
    const server = new FakeWebSocketServer();
    protocol.register(server as unknown as LocalWebSocketServer);
    useMFWStore.getState().setControllerInfo("adb", "old", {});
    const promise = protocol.disconnectControllerAndWait("old");
    const rejected = expect(promise).rejects.toThrow("超时");
    vi.advanceTimersByTime(12_000);
    await rejected;
    expect(useMFWStore.getState().controllerId).toBe("old");
    protocol.unregister();
  });

  it("rejects a pending disconnect when the protocol is disposed", async () => {
    const protocol = new MFWProtocol();
    const server = new FakeWebSocketServer();
    protocol.register(server as unknown as LocalWebSocketServer);
    const promise = protocol.disconnectControllerAndWait("old");
    const rejected = expect(promise).rejects.toThrow("协议已注销");
    protocol.unregister();
    await rejected;
  });

});
