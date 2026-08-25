import { describe, expect, it, vi } from "vitest";
import type { LocalWebSocketServer } from "../server";
import { InterfaceProtocol } from "./InterfaceProtocol";

type RouteHandler = (data: unknown) => void;

class FakeWebSocketServer {
  readonly sent: Array<{ path: string; data: unknown }> = [];
  private readonly routes = new Map<string, RouteHandler>();

  registerRoute(path: string, handler: RouteHandler): void {
    this.routes.set(path, handler);
  }

  send(path: string, data: unknown): boolean {
    this.sent.push({ path, data });
    return true;
  }

  deliver(path: string, data: unknown): void {
    this.routes.get(path)?.(data);
  }
}

describe("InterfaceProtocol", () => {
  it("sends semantic PI requests", () => {
    const server = new FakeWebSocketServer();
    const protocol = new InterfaceProtocol();
    protocol.register(server as unknown as LocalWebSocketServer);

    protocol.requestStatus();
    protocol.requestSnapshot("zh_cn");
    protocol.resolveContext({
      revision: "r1",
      language: "zh_cn",
      controllerName: "c",
      resourceName: "r",
      optionValues: {},
      agentEnabled: { "pi-agent-1": false },
      agentOverrides: {
        "pi-agent-1": { childExec: "python", childArgs: ["agent.py"] },
      },
    });
    protocol.disposeContext("context-1");

    expect(server.sent.map((item) => item.path)).toEqual([
      "/etl/interface/status",
      "/etl/interface/snapshot",
      "/etl/interface/context/resolve",
      "/etl/interface/context/dispose",
    ]);
    expect(server.sent[2]?.data).toMatchObject({
      agentEnabled: { "pi-agent-1": false },
      agentOverrides: {
        "pi-agent-1": { childExec: "python", childArgs: ["agent.py"] },
      },
    });
  });

  it("forwards change, context disposal, and agent events", () => {
    const server = new FakeWebSocketServer();
    const protocol = new InterfaceProtocol();
    protocol.register(server as unknown as LocalWebSocketServer);
    const changed = vi.fn();
    const disposed = vi.fn();
    const agent = vi.fn();
    protocol.onChanged(changed);
    protocol.onContextDisposed(disposed);
    protocol.onAgent(agent);

    server.deliver("/lte/interface/changed", { status: { state: "invalid" } });
    server.deliver("/lte/interface/context_disposed", { contextId: "context-1" });
    server.deliver("/lte/interface/agent", { contextId: "context-1", agentId: "agent-1", state: "exited" });

    expect(changed).toHaveBeenCalledWith({ status: { state: "invalid" } });
    expect(disposed).toHaveBeenCalledWith({ contextId: "context-1" });
    expect(agent).toHaveBeenCalledWith({ contextId: "context-1", agentId: "agent-1", state: "exited" });
  });
});
