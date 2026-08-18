import { describe, expect, it } from "vitest";
import type { HarnessModule, ToolHandler } from "../core/types";
import { registerHarnessModules } from "./registerModules";

const handler: ToolHandler = (_argumentsValue, context) => ({
  ok: true,
  stateVersion: context.expectedStateVersion,
});

describe("registerHarnessModules", () => {
  it("统一注册模块声明的 Skill、工具和 Handler", () => {
    const module: HarnessModule = {
      skills: [
        {
          id: "test-skill",
          version: "1",
          name: "测试 Skill",
          description: "测试",
          instructions: "执行测试",
        },
      ],
      tools: [
        {
          name: "test_tool",
          description: "测试工具",
          inputSchema: { type: "object" },
        },
      ],
      toolHandlers: { test_tool: handler },
    };

    const result = registerHarnessModules([module]);

    expect(result.registry.getSkill("test-skill")?.name).toBe("测试 Skill");
    expect(result.registry.getTool("test_tool")?.name).toBe("test_tool");
    expect(result.toolHandlers.test_tool).toBe(handler);
  });

  it("拒绝不同模块注册同名 Handler", () => {
    const module: HarnessModule = { toolHandlers: { duplicate: handler } };

    expect(() => registerHarnessModules([module, module])).toThrow(
      "工具 Handler 已注册",
    );
  });
});
