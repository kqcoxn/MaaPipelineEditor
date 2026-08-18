import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { XProvider } from "@ant-design/x";
import { canvasChatProfile } from "@/features/ai-harness";
import type { HarnessRun, RunEvent } from "@/features/ai-harness";
import { AIConversationRun } from "./AIConversationRun";

function createRun(status: HarnessRun["status"] = "succeeded"): HarnessRun {
  return {
    id: "run-1",
    sessionId: "session-1",
    goal: "测试 Markdown",
    status,
    createdAt: 1,
    finishedAt: status === "succeeded" ? 2 : undefined,
    profileSnapshot: canvasChatProfile,
    capabilitySnapshot: {
      id: "all",
      version: "1",
      description: "全部工具",
      skillIds: [],
      toolNames: ["*"],
    },
    policySnapshot: canvasChatProfile.defaultPolicy,
    modelSnapshot: {
      type: "openai",
      apiUrl: "https://example.com",
      model: "test",
      temperature: 0,
    },
    turnCount: 1,
    toolCallCount: 1,
    tokenUsage: {
      promptTokens: 1,
      completionTokens: 1,
      totalTokens: 2,
      isEstimated: false,
    },
    changedCanvas: true,
  };
}

function renderRun(run: HarnessRun, events: RunEvent[], streamingText = "") {
  return render(
    <XProvider>
      <AIConversationRun
        run={run}
        events={events}
        streamingText={streamingText}
      />
    </XProvider>,
  );
}

describe("AIConversationRun", () => {
  it("用 XMarkdown 渲染双方消息并转义原始 HTML", () => {
    const events: RunEvent[] = [
      {
        id: "user-1",
        runId: "run-1",
        sessionId: "session-1",
        type: "user_message",
        timestamp: 1,
        text: "用户 **加粗**",
      },
      {
        id: "assistant-1",
        runId: "run-1",
        sessionId: "session-1",
        type: "assistant_message",
        timestamp: 2,
        text: "AI **回答** <script>window.bad = true</script>",
      },
    ];

    const { container } = renderRun(createRun(), events);

    expect(screen.getByText("加粗").tagName).toBe("STRONG");
    expect(screen.getByText("回答").tagName).toBe("STRONG");
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>");
  });

  it("用 ThoughtChain 展示工具审计信息", () => {
    const events: RunEvent[] = [
      {
        id: "tool-request",
        runId: "run-1",
        sessionId: "session-1",
        type: "tool_requested",
        timestamp: 1,
        toolCallId: "call-1",
        toolName: "read_canvas",
        argumentsSummary: '{"scope":"all"}',
      },
      {
        id: "tool-result",
        runId: "run-1",
        sessionId: "session-1",
        type: "tool_result",
        timestamp: 2,
        toolCallId: "call-1",
        result: {
          ok: true,
          data: { nodes: 2 },
          changes: ["读取 2 个节点"],
          stateVersion: 7,
          undoable: true,
        },
      },
    ];

    renderRun(createRun(), events);

    expect(screen.getByText("工具调用")).toBeInTheDocument();
    fireEvent.click(screen.getByText("read_canvas"));
    expect(screen.getByText('{"scope":"all"}')).toBeInTheDocument();
    expect(screen.getByText("读取 2 个节点")).toBeInTheDocument();
    expect(screen.getByText("v7 · 可撤销")).toBeInTheDocument();
  });

  it("渲染仍在生成的 Markdown 内容", () => {
    const { container } = renderRun(
      createRun("running"),
      [],
      "正在生成 **内容**",
    );

    expect(screen.getByText("内容").closest("strong")).not.toBeNull();
    expect(container.textContent).toContain("▋");
  });
});
