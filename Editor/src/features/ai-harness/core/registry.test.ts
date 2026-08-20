import { describe, expect, it } from "vitest";
import {
  ALL_REGISTERED_CAPABILITIES_PACK_ID,
  HarnessRegistry,
} from "./registry";
import type { BusinessProfile } from "./types";

const testProfile: BusinessProfile = {
  id: "test-profile",
  version: "1.0.0",
  name: "测试业务",
  description: "测试 Business Profile",
  capabilityPackId: ALL_REGISTERED_CAPABILITIES_PACK_ID,
  systemPrompt: "执行测试目标",
  inheritSessionContext: true,
  maxSessionMessages: 10,
  requiredToolNames: [],
  defaultPolicy: {
    maxTurns: 4,
    maxToolCalls: 8,
    maxRetriesPerToolError: 1,
    serialRunsPerSession: true,
    autoApproveTools: true,
  },
};

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
      skillIds: ["test-skill"],
      toolNames: ["read_canvas"],
    });
    registry.registerSkill({
      id: "test-skill",
      version: "1.0.0",
      name: "测试 Skill",
      description: "测试说明",
      instructions: "测试指导文本",
    });
    registry.registerProfile(testProfile);

    const profile = registry.snapshotProfile(testProfile.id);
    const pack = registry.snapshotCapabilityPack("canvas");

    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.defaultPolicy)).toBe(true);
    expect(Object.isFrozen(pack.toolNames)).toBe(true);
    expect(Object.isFrozen(pack.skillIds)).toBe(true);
    expect(registry.getSkill("test-skill")?.instructions).toBe("测试指导文本");
    expect(registry.getTool("read_canvas")?.name).toBe("read_canvas");
  });

  it("拒绝重复注册", () => {
    const registry = new HarnessRegistry();
    registry.registerProfile(testProfile);
    expect(() => registry.registerProfile(testProfile)).toThrow(
      "Business Profile 已注册",
    );
  });

  it("为 AI 对话快照全部已注册工具", () => {
    const registry = new HarnessRegistry();
    ["read_canvas", "update_node"].forEach((name) =>
      registry.registerTool({
        name,
        description: name,
        inputSchema: { type: "object" },
      }),
    );
    registry.registerSkill({
      id: "maafw-pipeline",
      version: "1.0.0",
      name: "MaaFramework Pipeline",
      description: "Pipeline 协议",
      instructions: "按协议生成节点",
    });

    const pack = registry.snapshotCapabilityPack(
      ALL_REGISTERED_CAPABILITIES_PACK_ID,
    );

    expect(pack.toolNames).toEqual(["read_canvas", "update_node"]);
    expect(pack.skillIds).toEqual(["maafw-pipeline"]);
    expect(Object.isFrozen(pack.toolNames)).toBe(true);
    expect(testProfile.capabilityPackId).toBe(
      ALL_REGISTERED_CAPABILITIES_PACK_ID,
    );
  });
});
