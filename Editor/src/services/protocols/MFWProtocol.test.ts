import { describe, expect, it } from "vitest";
import type { LocalWebSocketServer } from "../server";
import { MFWProtocol } from "./MFWProtocol";

type RouteHandler = (data: unknown) => void;

class FakeWebSocketServer {
  private readonly statusListeners = new Set<(connected: boolean) => void>();

  get statusListenerCount(): number {
    return this.statusListeners.size;
  }

  onStatus(listener: (connected: boolean) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  registerRoute(_path: string, _handler: RouteHandler): void {}
}

describe("MFWProtocol", () => {
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
});
