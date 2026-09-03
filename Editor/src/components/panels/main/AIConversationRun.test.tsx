import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { XProvider } from "@ant-design/x";
import { canvasChatProfile } from "@/features/ai-harness";
import { useBusinessArchitectureStore } from "@/features/ai-harness";
import type { HarnessRun, RunEvent } from "@/features/ai-harness";
import { AIConversationRun } from "./AIConversationRun";

vi.mock("@ant-design/x", async () => {
  const actual = await vi.importActual<typeof import("@ant-design/x")>(
    "@ant-design/x",
  );
  return {
    ...actual,
    Mermaid: ({ children }: { children?: import("react").ReactNode }) =>
      <div data-testid="mermaid-test-renderer">{children}</div>,
  };
});

function createRun(status: HarnessRun["status"] = "succeeded"): HarnessRun {
  return {
    id: "run-1",
    sessionId: "session-1",
    goal: "测试 Markdown",
    status,
    createdAt: 1,
    finishedAt: status === "running" ? undefined : 2,
    profileSnapshot: canvasChatProfile,
    capabilitySnapshot: {
      id: "all",
      version: "1",
      description: "全部工具",
      skillIds: [],
      toolNames: ["*"],
    },
    policySnapshot: {
      ...canvasChatProfile.defaultPolicy,
      compactionThresholdTokens: 200_000,
    },
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

function renderRun(
  run: HarnessRun,
  events: RunEvent[],
  streamingText = "",
  streamingReasoning = "",
) {
  return render(
    <XProvider>
      <AIConversationRun
        run={run}
        events={events}
        streamingText={streamingText}
        streamingReasoning={streamingReasoning}
      />
    </XProvider>,
  );
}

describe("AIConversationRun", () => {
  beforeEach(() => {
    useBusinessArchitectureStore.getState().clear();
  });

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

  it("使用产品 logo 作为 AI 头像", () => {
    const events: RunEvent[] = [
      {
        id: "assistant-1",
        runId: "run-1",
        sessionId: "session-1",
        type: "assistant_message",
        timestamp: 1,
        text: "AI 回答",
      },
    ];

    renderRun(createRun(), events);

    const avatar = screen.getByAltText("MPE Harness");
    expect(avatar).toHaveAttribute("src", "/logo.png");
    expect(avatar.closest("span")).toHaveStyle({
      width: "28px",
      height: "28px",
    });
    expect(screen.getByText("MPE Harness")).toBeInTheDocument();
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

  it("在成功 Run 的 AI 消息中展示流程架构产物并按需打开", () => {
    useBusinessArchitectureStore.getState().setDocument({
      title: "日常作业",
      summary: "完成日常作业并处理异常。",
      fileName: "daily.json",
      sourceRunId: "run-1",
      sourceStateVersion: 1,
      sourceSignature: "signature",
      generatedAt: 1,
      stages: [
        {
          id: "main",
          title: "执行作业",
          description: "完成主要任务。",
          kind: "main",
          nodeIds: ["start"],
        },
      ],
      transitions: [],
      coverage: {
        includedNodeCount: 1,
        totalNodeCount: 1,
        autoAssignedNodeIds: [],
      },
    });

    renderRun(createRun(), [
      {
        id: "assistant-1",
        runId: "run-1",
        sessionId: "session-1",
        type: "assistant_message",
        timestamp: 2,
        text: "架构图已生成。",
      },
    ]);

    expect(
      useBusinessArchitectureStore.getState().activeDocumentRunId,
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "打开流程架构：日常作业" }));
    expect(useBusinessArchitectureStore.getState().activeDocumentRunId).toBe(
      "run-1",
    );
  });

  it("按事件时间线交错展示 AI 消息和工具调用", () => {
    const events: RunEvent[] = [
      {
        id: "assistant-before-tool",
        runId: "run-1",
        sessionId: "session-1",
        type: "assistant_message",
        timestamp: 1,
        text: "先说明处理方式",
      },
      {
        id: "tool-request",
        runId: "run-1",
        sessionId: "session-1",
        type: "tool_requested",
        timestamp: 2,
        toolCallId: "call-1",
        toolName: "update_node",
        argumentsSummary: '{}',
      },
      {
        id: "tool-result",
        runId: "run-1",
        sessionId: "session-1",
        type: "tool_result",
        timestamp: 3,
        toolCallId: "call-1",
        result: {
          ok: true,
          stateVersion: 2,
        },
      },
      {
        id: "assistant-after-tool",
        runId: "run-1",
        sessionId: "session-1",
        type: "assistant_message",
        timestamp: 4,
        text: "再汇报处理结果",
      },
    ];

    renderRun(createRun(), events);

    const beforeTool = screen.getByText("先说明处理方式");
    const tool = screen.getByText("update_node");
    const afterTool = screen.getByText("再汇报处理结果");
    expect(beforeTool.compareDocumentPosition(tool)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(tool.compareDocumentPosition(afterTool)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("渲染仍在生成的 Markdown 内容", () => {
    const { container } = renderRun(
      createRun("running"),
      [],
      "正在生成 **内容**",
    );

    expect(screen.getByText("内容").closest("strong")).not.toBeNull();
    expect(container.textContent).toContain("▋");
    expect(
      container.querySelector('[style*="x-markdown-fade-in"]'),
    ).toBeNull();
  });

  it("将完成的 mermaid 代码块渲染为流程图", () => {
    const events: RunEvent[] = [
      {
        id: "assistant-mermaid",
        runId: "run-1",
        sessionId: "session-1",
        type: "assistant_message",
        timestamp: 1,
        text: "```mermaid\nflowchart TD\n  A --> B\n```",
      },
    ];

    renderRun(createRun(), events);

    expect(screen.getByLabelText("Mermaid 流程图")).toBeInTheDocument();
  });

  it("流式 mermaid 未闭合时保留源码而不提前解析", () => {
    renderRun(
      createRun("running"),
      [],
      "```mermaid\nflowchart TD\n  A --> B",
    );

    expect(screen.queryByLabelText("Mermaid 流程图")).toBeNull();
    expect(screen.getByText(/flowchart TD/).tagName).toBe("CODE");
  });

  it("普通代码块保持代码渲染", () => {
    const events: RunEvent[] = [
      {
        id: "assistant-code",
        runId: "run-1",
        sessionId: "session-1",
        type: "assistant_message",
        timestamp: 1,
        text: "```json\n{\"next\": \"B\"}\n```",
      },
    ];

    renderRun(createRun(), events);

    expect(screen.queryByLabelText("Mermaid 流程图")).toBeNull();
    expect(screen.getByText('{"next": "B"}').tagName).toBe("CODE");
  });

  it("思考流输出期间展开，正文开始后自动折叠", () => {
    const { rerender } = renderRun(
      createRun("running"),
      [],
      "",
      "正在分析节点关系",
    );

    expect(screen.getByText("思考中")).toBeInTheDocument();
    expect(screen.getByText("正在分析节点关系")).toBeVisible();

    rerender(
      <XProvider>
        <AIConversationRun
          run={createRun("running")}
          events={[]}
          streamingText="开始回答"
          streamingReasoning="正在分析节点关系"
        />
      </XProvider>,
    );

    const completedThinking = screen
      .getByText("已思考")
      .closest("[data-streaming-expanded]");
    expect(completedThinking).toHaveAttribute("data-streaming-expanded", "false");
    expect(screen.queryByText("正在分析节点关系")).toBeNull();
    expect(screen.getByText("开始回答")).toBeVisible();

    fireEvent.click(screen.getByText("已思考"));
    expect(completedThinking).toHaveAttribute("data-streaming-expanded", "true");
    expect(screen.getByText("正在分析节点关系")).toBeInTheDocument();

    fireEvent.click(screen.getByText("已思考"));
    expect(completedThinking).toHaveAttribute("data-streaming-expanded", "false");
    expect(screen.queryByText("正在分析节点关系")).toBeNull();
  });

  it("完成后的思考默认折叠且可以手动查看", () => {
    const events: RunEvent[] = [
      {
        id: "reasoning-1",
        runId: "run-1",
        sessionId: "session-1",
        type: "assistant_reasoning",
        timestamp: 1,
        text: "历史思考内容",
      },
      {
        id: "assistant-1",
        runId: "run-1",
        sessionId: "session-1",
        type: "assistant_message",
        timestamp: 2,
        text: "最终回答",
      },
    ];

    renderRun(createRun(), events);

    expect(screen.queryByText("历史思考内容")).toBeNull();
    fireEvent.click(screen.getByText("已思考"));
    expect(screen.getByText("历史思考内容")).toBeInTheDocument();
    fireEvent.click(screen.getByText("已思考"));
    expect(screen.queryByText("历史思考内容")).toBeNull();
  });
});
