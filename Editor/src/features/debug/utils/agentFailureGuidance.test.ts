import { describe, expect, it } from "vitest";
import { buildAgentFailureGuidance } from "./agentFailureGuidance";

describe("Agent failure guidance", () => {
  it("distinguishes slow initialization and early exit from executable failures", () => {
    expect(buildAgentFailureGuidance("Agent 启动准备超时（3m0s）", "start").title).toBe("Agent 初始化超时");
    expect(buildAgentFailureGuidance("Agent python 已退出（退出码 7）", "start").title).toBe("Agent 进程提前退出");
    expect(buildAgentFailureGuidance("Agent 握手失败: connect failed", "start").title).toBe("Agent 进程未建立连接");
  });
  it("classifies executable launch failures", () => {
    const guidance = buildAgentFailureGuidance(
      "启动 PI Agent 失败: CreateProcess error=2",
      "start",
    );
    expect(guidance.title).toBe("Agent 进程未能启动");
  });

  it("classifies connection failures", () => {
    const guidance = buildAgentFailureGuidance(
      "Agent 连接超时（2s）",
      "connect",
    );
    expect(guidance.title).toBe("Agent 进程未建立连接");
  });

  it("keeps identifier conflicts more specific than the start stage", () => {
    const guidance = buildAgentFailureGuidance(
      "agent_context_conflict: identifier 已被另一上下文占用",
      "start",
    );
    expect(guidance.title).toBe("Agent 标识符发生冲突");
  });
});
