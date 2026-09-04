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
});
