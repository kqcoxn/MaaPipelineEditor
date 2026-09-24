import { describe, expect, it } from "vitest";
import { buildAgentFailureGuidance } from "./agentFailureGuidance";

describe("Agent failure guidance", () => {
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
