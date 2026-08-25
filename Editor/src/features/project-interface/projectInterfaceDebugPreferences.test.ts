import { beforeEach, describe, expect, it } from "vitest";
import {
  loadProjectInterfaceAgentPreferences,
  saveProjectInterfaceAgentPreferences,
} from "./projectInterfaceDebugPreferences";

describe("Project Interface Agent 调试偏好", () => {
  beforeEach(() => localStorage.clear());

  it("按项目持久化 Agent 开关和启动命令覆盖", () => {
    saveProjectInterfaceAgentPreferences("project-a", {
      enabled: { "pi-agent-1": false },
      overrides: {
        "pi-agent-1": {
          childExec: "python",
          childArgs: ["-m", "agent.dev"],
        },
      },
    });

    expect(loadProjectInterfaceAgentPreferences("project-a")).toEqual({
      enabled: { "pi-agent-1": false },
      overrides: {
        "pi-agent-1": {
          childExec: "python",
          childArgs: ["-m", "agent.dev"],
        },
      },
    });
    expect(loadProjectInterfaceAgentPreferences("project-b")).toEqual({
      enabled: {},
      overrides: {},
    });
  });

  it("忽略损坏或无效的持久化字段", () => {
    localStorage.setItem(
      "mpe_pi_debug_preferences_v1",
      JSON.stringify({
        projects: {
          demo: {
            enabled: { valid: false, invalid: "false" },
            overrides: {
              valid: { childExec: " node ", childArgs: ["dev.js", 1] },
              empty: { childExec: "" },
            },
          },
        },
      }),
    );

    expect(loadProjectInterfaceAgentPreferences("demo")).toEqual({
      enabled: { valid: false },
      overrides: { valid: { childExec: "node", childArgs: ["dev.js"] } },
    });
  });
});
