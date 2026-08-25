import { describe, expect, it } from "vitest";
import { buildAgentFailureGuidance } from "./agentFailureGuidance";

describe("Agent failure guidance", () => {
  it("guides executable launch failures toward command and cwd", () => {
    const guidance = buildAgentFailureGuidance(
      "启动 PI Agent 失败: CreateProcess error=2",
      "start",
    );
    expect(guidance.title).toBe("Agent 进程未能启动");
    expect(guidance.checks.join(" ")).toContain("启动程序");
    expect(guidance.checks.join(" ")).toContain("工作目录");
  });

  it("guides connection failures toward MaaFramework versions", () => {
    const guidance = buildAgentFailureGuidance(
      "Agent 连接超时（2s）",
      "connect",
    );
    expect(guidance.title).toBe("Agent 进程未建立连接");
    expect(guidance.checks.join(" ")).toContain("MaaFramework");
    expect(guidance.checks.join(" ")).not.toContain("从命令行最后一个参数读取");
  });

  it("keeps identifier conflicts more specific than the start stage", () => {
    const guidance = buildAgentFailureGuidance(
      "agent_context_conflict: identifier 已被另一上下文占用",
      "start",
    );
    expect(guidance.title).toBe("Agent 标识符发生冲突");
    expect(guidance.checks.join(" ")).toContain("并行上下文");
  });
});
