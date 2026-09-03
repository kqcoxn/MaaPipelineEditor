import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App as AntdApp } from "antd";
import antdZhCN from "antd/locale/zh_CN";
import { XProvider } from "@ant-design/x";
import xZhCN from "@ant-design/x/locale/zh_CN";
import {
  canvasChatProfile,
  harnessRunner,
  SEMANTIC_LAYOUT_PROFILE_ID,
  type HarnessRun,
  useAIHarnessStore,
} from "@/features/ai-harness";
import { useConfigStore } from "@/stores/app/configStore";
import { createPipelineNode, useFlowStore } from "@/stores/flow";
import AIHistoryPanel from "./AIHistoryPanel";

describe("AIHistoryPanel", () => {
  function renderPanel() {
    return render(
      <XProvider locale={{ ...antdZhCN, ...xZhCN }}>
        <AntdApp>
          <AIHistoryPanel />
        </AntdApp>
      </XProvider>,
    );
  }

  function createRunningRun(sessionId: string): HarnessRun {
    return {
      id: "run-active",
      sessionId,
      goal: "运行中",
      status: "running",
      createdAt: Date.now(),
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
      turnCount: 0,
      toolCallCount: 0,
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        isEstimated: false,
      },
      changedCanvas: false,
    };
  }

  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    useAIHarnessStore.getState().reset();
    useFlowStore.setState({ nodes: [], edges: [] });
    useConfigStore.getState().setStatus("showAIHistoryPanel", true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useConfigStore.getState().setStatus("showAIHistoryPanel", false);
  });

  it("新建并切换 Session", async () => {
    renderPanel();

    expect(screen.getByText("Infra BETA")).toBeInTheDocument();

    fireEvent.click(await screen.findByLabelText("切换 Session"));
    fireEvent.click(await screen.findByText("新建 Session"));
    expect(useAIHarnessStore.getState().sessions).toHaveLength(2);

    const firstSession = useAIHarnessStore.getState().sessions[1];
    fireEvent.click(screen.getByLabelText("切换 Session"));
    const sessionItems = (await screen.findByLabelText("AI Session 列表"))
      .querySelectorAll("li");
    fireEvent.click(sessionItems[1]);
    expect(useAIHarnessStore.getState().activeSessionId).toBe(firstSession.id);
  });

  it("发送用户目标并交给 Harness Runner", async () => {
    const start = vi.spyOn(harnessRunner, "start").mockResolvedValue("run-test");
    renderPanel();

    const sender = await screen.findByPlaceholderText("输入目标或问题");
    fireEvent.change(sender, {
      target: { value: "读取当前画布" },
    });
    fireEvent.keyDown(sender, { key: "Enter", code: "Enter" });

    await waitFor(() =>
      expect(start).toHaveBeenCalledWith(
        "读取当前画布",
        { sessionId: useAIHarnessStore.getState().activeSessionId },
      ),
    );
  });

  it("通过模糊命令菜单执行 /compact", async () => {
    const compact = vi.spyOn(harnessRunner, "compact").mockResolvedValue({
      compacted: false,
      tokensBefore: 10,
      tokensAfter: 10,
    });
    renderPanel();

    const sender = await screen.findByPlaceholderText("输入目标或问题");
    fireEvent.change(sender, { target: { value: "/cmp" } });
    expect(screen.getByRole("listbox", { name: "Harness 命令" })).toBeInTheDocument();
    fireEvent.keyDown(sender, { key: "Enter", code: "Enter" });
    expect(sender).toHaveValue("/compact ");
    fireEvent.change(sender, { target: { value: "/compact" } });
    fireEvent.keyDown(sender, { key: "Enter", code: "Enter" });

    await waitFor(() =>
      expect(compact).toHaveBeenCalledWith(
        useAIHarnessStore.getState().activeSessionId,
        "",
      ),
    );
  });

  it("从 Harness 面板启动专用 AI 语义重排", async () => {
    const start = vi.spyOn(harnessRunner, "start").mockResolvedValue("run-layout");
    useFlowStore.setState({
      nodes: [createPipelineNode("layout-node", { label: "开始" })],
    });
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "AI 重排" }));

    await waitFor(() =>
      expect(start).toHaveBeenCalledWith("AI 语义重排当前画布", {
        sessionId: useAIHarnessStore.getState().activeSessionId,
        profileId: SEMANTIC_LAYOUT_PROFILE_ID,
      }),
    );
  });

  it("用独立容器为 Sender 提供左右间距", async () => {
    renderPanel();

    const sender = await screen.findByPlaceholderText("输入目标或问题");
    expect(screen.getByTestId("ai-composer-shell")).toContainElement(sender);
  });

  it("将收起动画限制在 Drawer 根节点内", async () => {
    renderPanel();

    await screen.findByText("MPE Harness");
    const drawer = document.querySelector<HTMLElement>(".ant-drawer");

    expect(drawer).toHaveStyle({ overflow: "hidden" });
  });

  it("用品牌欢迎态引导新对话", async () => {
    renderPanel();

    expect(await screen.findByText("从当前 Pipeline 开始")).toBeInTheDocument();
    expect(screen.queryByText("暂无对话")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("检查当前 Pipeline"));
    expect(screen.getByPlaceholderText("输入目标或问题")).toHaveValue(
      "检查当前 Pipeline",
    );
  });

  it("通过 Sender 停止当前 Run", async () => {
    const sessionId = useAIHarnessStore.getState().activeSessionId;
    useAIHarnessStore.getState().addRun(createRunningRun(sessionId));
    const stop = vi.spyOn(harnessRunner, "stop");
    renderPanel();

    const stopIcon = await screen.findByTitle("停止请求");
    fireEvent.click(stopIcon.closest("button")!);

    expect(stop).toHaveBeenCalledWith("run-active");
  });
});
