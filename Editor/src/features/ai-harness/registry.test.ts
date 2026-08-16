import { describe, expect, it } from "vitest";
import { canvasChatProfile, HarnessRegistry } from "./registry";

describe("HarnessRegistry", () => {
  it("注册并冻结 Business Profile、Capability Pack 和工具快照", () => {
    const registry = new HarnessRegistry();
    registry.registerTool({
      name: "read_canvas",
      description: "读取画布",
      inputSchema: { type: "object", additionalProperties: false },
    });
    registry.registerCapabilityPack({
      id: "canvas",
      version: "1.0.0",
      description: "画布能力",
      toolNames: ["read_canvas"],
    });
    registry.registerProfile(canvasChatProfile);

    const profile = registry.snapshotProfile("canvas-chat");
    const pack = registry.snapshotCapabilityPack("canvas");

    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.defaultPolicy)).toBe(true);
    expect(Object.isFrozen(pack.toolNames)).toBe(true);
    expect(registry.getTool("read_canvas")?.name).toBe("read_canvas");
  });

  it("拒绝重复注册", () => {
    const registry = new HarnessRegistry();
    registry.registerProfile(canvasChatProfile);
    expect(() => registry.registerProfile(canvasChatProfile)).toThrow(
      "Business Profile 已注册",
    );
  });
});

