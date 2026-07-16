import { describe, expect, it, vi } from "vitest";
import { DebugCommandBus } from "./debugCommandBus";

describe("DebugCommandBus", () => {
  it("routes start and stop through the active handler", async () => {
    const bus = new DebugCommandBus();
    const start = vi.fn();
    const stop = vi.fn();
    bus.register({ start, stop });

    await expect(bus.start({ mode: "single-node-run", nodeId: "node-a" })).resolves.toBe(true);
    await expect(bus.stop({ reason: "desktop_shortcut" })).resolves.toBe(true);

    expect(start).toHaveBeenCalledWith({ mode: "single-node-run", nodeId: "node-a" });
    expect(stop).toHaveBeenCalledWith({ reason: "desktop_shortcut" });
  });

  it("does not let an old cleanup remove a replacement handler", async () => {
    const bus = new DebugCommandBus();
    const first = { start: vi.fn(), stop: vi.fn() };
    const second = { start: vi.fn(), stop: vi.fn() };
    const unregisterFirst = bus.register(first);
    bus.register(second);

    unregisterFirst();
    await bus.stop();

    expect(first.stop).not.toHaveBeenCalled();
    expect(second.stop).toHaveBeenCalledOnce();
  });
});
