import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BRIDGE_PROTOCOL_VERSION, type RpcRequest } from "./generated/bridge-v2";
import { LocalWebSocketServer } from "./server";

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readonly requests: RpcRequest[] = [];

  constructor(
    readonly url: string,
    readonly protocol: string,
  ) {
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = FakeWebSocket.OPEN;
      this.onopen?.(new Event("open"));
    });
  }

  send(data: string): void {
    const request = JSON.parse(data) as RpcRequest;
    this.requests.push(request);
    if (request.method === "system.hello") {
      queueMicrotask(() =>
        this.respond(request.id, {
          protocolVersion: BRIDGE_PROTOCOL_VERSION,
          packageVersion: "1.7.5",
        }),
      );
    }
  }

  respond(id: string, result: unknown): void {
    this.onmessage?.(
      new MessageEvent("message", {
        data: JSON.stringify({ v: 2, type: "response", id, result }),
      }),
    );
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close"));
  }
}

describe("LocalWebSocketServer", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    sessionStorage.clear();
    window.location.hash = "mpelb-port=9066";
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("correlates responses when requests finish out of order", async () => {
    const server = new LocalWebSocketServer();
    const connected = new Promise<void>((resolve) => {
      server.onStatus((value) => value && resolve());
    });
    server.connect();
    await connected;

    const socket = FakeWebSocket.instances[0];
    const hello = socket.requests.find((request) => request.method === "system.hello");
    expect(hello?.params).not.toHaveProperty("token");
    const first = server.request<{ order: number }>("system.health", { order: 1 });
    const second = server.request<{ order: number }>("system.health", { order: 2 });
    const requests = socket.requests.filter((request) => request.method === "system.health");
    socket.respond(requests[1].id, { order: 2 });
    socket.respond(requests[0].id, { order: 1 });

    await expect(first).resolves.toEqual({ order: 1 });
    await expect(second).resolves.toEqual({ order: 2 });
    server.destroy();
  });

  it("revokes replaced and remaining artifact object URLs", () => {
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const server = new LocalWebSocketServer();

    expect(server.cacheArtifactUrl("artifact", new Blob(["first"]))).toBe("blob:first");
    expect(server.cacheArtifactUrl("artifact", new Blob(["second"]))).toBe("blob:second");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:first");

    server.destroy();
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:second");
  });

  it("does not reconnect after the active connection closes", async () => {
    const server = new LocalWebSocketServer();
    const connected = new Promise<void>((resolve) => {
      server.onStatus((value) => value && resolve());
    });
    server.connect();
    await connected;
    vi.useFakeTimers();

    FakeWebSocket.instances[0].close();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(FakeWebSocket.instances).toHaveLength(1);
    server.destroy();
    vi.useRealTimers();
  });
});

describe("generated bridge contract", () => {
  it("uses protocol 2.4.0", () => {
    expect(BRIDGE_PROTOCOL_VERSION).toBe("2.4.0");
  });
});
