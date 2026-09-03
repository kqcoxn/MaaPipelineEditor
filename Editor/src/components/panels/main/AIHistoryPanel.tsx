import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { App as AntdApp, Button, Drawer, Popover, Tag, Tooltip } from "antd";
import { Conversations, Prompts, Sender, Welcome } from "@ant-design/x";
import {
  ClearOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownOutlined,
  HistoryOutlined,
  ApartmentOutlined,
  NodeIndexOutlined,
  PartitionOutlined,
  SearchOutlined,
  ToolOutlined,
} from "@ant-design/icons";

import {
  BUSINESS_ARCHITECTURE_PROFILE_ID,
  harnessRunner,
  SEMANTIC_LAYOUT_PROFILE_ID,
  type HarnessRun,
  useAIHarnessStore,
} from "@/features/ai-harness";
import {
  getHarnessCommandQuery,
  parseHarnessCommand,
  searchHarnessCommands,
} from "@/features/ai-harness/commands";
import { useConfigStore } from "@/stores/app/configStore";
import { useFlowStore } from "@/stores/flow";
import { useControlledPanelOccupancy } from "../../../hooks/useControlledPanelOccupancy";
import {
  AIConversationRun,
  formatAIConversationTime,
} from "./AIConversationRun";
import { AIHarnessErrorBoundary } from "./AIHarnessErrorBoundary";
import { WikiAnchor } from "../../wiki/WikiAnchor";
import style from "../../../styles/panels/AIHistoryPanel.module.less";

const MOBILE_QUERY = "(max-width: 720px)";
const MPE_LOGO_URL = `${import.meta.env.BASE_URL}logo.png`;
const STARTER_PROMPTS = [
  {
    key: "inspect",
    icon: <SearchOutlined />,
    label: "检查当前 Pipeline",
  },
  {
    key: "explain",
    icon: <NodeIndexOutlined />,
    label: "解释选中的节点",
  },
  {
    key: "improve",
    icon: <ToolOutlined />,
    label: "优化流程结构",
  },
];

function useMobileDrawer(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(MOBILE_QUERY).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return mobile;
}

function AIHistoryPanel() {
  const show = useConfigStore((state) => state.status.showAIHistoryPanel);
  const setStatus = useConfigStore((state) => state.setStatus);
  const closePanel = useCallback(
    () => setStatus("showAIHistoryPanel", false),
    [setStatus],
  );
  const panelOpen = useControlledPanelOccupancy(
    "aiHistory",
    show,
    closePanel,
  );
  const [draft, setDraft] = useState("");
  const [drawerSize, setDrawerSize] = useState(620);

  if (!panelOpen) return null;
  return (
    <AIHistoryPanelContent
      closePanel={closePanel}
      draft={draft}
      setDraft={setDraft}
      drawerSize={drawerSize}
      setDrawerSize={setDrawerSize}
    />
  );
}

function AIHistoryPanelContent({
  closePanel,
  draft,
  setDraft,
  drawerSize,
  setDrawerSize,
}: {
  closePanel: () => void;
  draft: string;
  setDraft: (value: string) => void;
  drawerSize: number;
  setDrawerSize: (value: number) => void;
}) {
  const { modal, message } = AntdApp.useApp();
  const mobile = useMobileDrawer();
  const [sessionSwitcherOpen, setSessionSwitcherOpen] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const panelOpen = true;
  const sessions = useAIHarnessStore((state) => state.sessions);
  const activeSessionId = useAIHarnessStore((state) => state.activeSessionId);
  const runs = useAIHarnessStore((state) => state.runs);
  const events = useAIHarnessStore((state) => state.events);
  const activeRunId = useAIHarnessStore((state) => state.activeRunId);
  const pendingRunSessionId = useAIHarnessStore(
    (state) => state.pendingRunSessionId,
  );
  const nodeCount = useFlowStore((state) => state.nodes.length);
  const streamingText = useAIHarnessStore((state) => state.streamingText);
  const streamingReasoning = useAIHarnessStore(
    (state) => state.streamingReasoning,
  );
  const createSession = useAIHarnessStore((state) => state.createSession);
  const switchSession = useAIHarnessStore((state) => state.switchSession);
  const clearSession = useAIHarnessStore((state) => state.clearSession);
  const deleteSession = useAIHarnessStore((state) => state.deleteSession);

  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const sessionRuns = useMemo(
    () =>
      (activeSession?.runIds ?? [])
        .map((runId) => runs[runId])
        .filter((run): run is HarnessRun => Boolean(run)),
    [activeSession?.runIds, runs],
  );
  const currentRun = activeRunId ? runs[activeRunId] : undefined;
  const isCurrentSessionRunning = Boolean(
    currentRun && currentRun.sessionId === activeSessionId,
  );
  const isAnyRunRunning = Boolean(currentRun || pendingRunSessionId);
  const commandQuery = getHarnessCommandQuery(draft);
  const commandOptions = useMemo(
    () => (commandQuery === null ? [] : searchHarnessCommands(commandQuery)),
    [commandQuery],
  );
  const commandMenuOpen = commandQuery !== null && commandOptions.length > 0;

  useEffect(() => {
    setActiveCommandIndex(0);
  }, [commandQuery]);

  const conversationItems = useMemo(
    () =>
      sessions.map((session) => ({
        key: session.id,
        label: (
          <div className={style.sessionLabel} title={session.title}>
            <span className={style.sessionTitle}>{session.title}</span>
            <span className={style.sessionMeta}>
              {session.runIds.length} Runs · {formatAIConversationTime(session.updatedAt)}
            </span>
          </div>
        ),
      })),
    [sessions],
  );

  const handleSend = useCallback(async (messageText: string) => {
    const goal = messageText.trim();
    if (!goal || isAnyRunRunning) return;
    setDraft("");
    const parsedCommand = parseHarnessCommand(goal);
    if (parsedCommand?.command.name === "compact") {
      try {
        const result = await harnessRunner.compact(
          activeSessionId,
          parsedCommand.instructions,
        );
        if (result.compacted) {
          message.success(
            `上下文已压缩（${result.tokensBefore} → ${result.tokensAfter} tokens）`,
          );
        } else {
          message.info("当前 Session 没有达到可压缩的上下文长度");
        }
      } catch (error) {
        setDraft(goal);
        message.error(error instanceof Error ? error.message : "上下文压缩失败");
      }
      return;
    }
    try {
      await harnessRunner.start(goal, { sessionId: activeSessionId });
    } catch (error) {
      setDraft(goal);
      message.error(error instanceof Error ? error.message : "无法启动 AI Run");
    }
  }, [activeSessionId, isAnyRunRunning, message, setDraft]);

  const handleCommandKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!commandMenuOpen) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveCommandIndex((index) =>
          Math.min(index + 1, commandOptions.length - 1),
        );
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveCommandIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setDraft("");
        return;
      }
      if (event.key === "Enter") {
        const selected = commandOptions[activeCommandIndex];
        if (selected && draft.trim() !== `/${selected.name}`) {
          event.preventDefault();
          setDraft(`/${selected.name} `);
          return false;
        }
      }
    },
    [activeCommandIndex, commandMenuOpen, commandOptions, draft, setDraft],
  );

  const handleSemanticLayout = useCallback(async () => {
    if (isAnyRunRunning) return;
    if (nodeCount === 0) {
      message.error("当前画布没有可重排的节点");
      return;
    }
    try {
      await harnessRunner.start("AI 语义重排当前画布", {
        sessionId: activeSessionId,
        profileId: SEMANTIC_LAYOUT_PROFILE_ID,
      });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "无法启动 AI 重排");
    }
  }, [activeSessionId, isAnyRunRunning, message, nodeCount]);

  const handleBusinessArchitecture = useCallback(async () => {
    if (isAnyRunRunning) return;
    if (nodeCount === 0) {
      message.error("当前画布没有可梳理的节点");
      return;
    }
    try {
      await harnessRunner.start("梳理当前 Pipeline 的业务流程架构", {
        sessionId: activeSessionId,
        profileId: BUSINESS_ARCHITECTURE_PROFILE_ID,
      });
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "无法生成流程架构",
      );
    }
  }, [
    activeSessionId,
    isAnyRunRunning,
    message,
    nodeCount,
  ]);

  const handleClear = useCallback(() => {
    if (!activeSession || activeSession.runIds.length === 0) return;
    modal.confirm({
      title: "清空当前 Session？",
      content: "该 Session 的 Run 和事件将从内存中移除。",
      okText: "清空",
      okType: "danger",
      cancelText: "取消",
      onOk: () => clearSession(activeSession.id),
    });
  }, [activeSession, clearSession, modal]);

  const handleDelete = useCallback(
    (sessionId: string, title: string) => {
      modal.confirm({
        title: `删除「${title}」？`,
        content: "该 Session 的 Run 和事件将从内存中移除。",
        okText: "删除",
        okType: "danger",
        cancelText: "取消",
        onOk: () => deleteSession(sessionId),
      });
    },
    [deleteSession, modal],
  );

  const sessionSwitcher = (
    <nav className={style.sessionPopover} aria-label="AI Session 列表">
      <Conversations
        rootClassName={style.sessionList}
        items={conversationItems}
        activeKey={activeSessionId}
        onActiveChange={(sessionId) => {
          switchSession(sessionId);
          setSessionSwitcherOpen(false);
        }}
        creation={{
          label: "新建 Session",
          onClick: () => {
            createSession();
            setSessionSwitcherOpen(false);
          },
        }}
        menu={(conversation) => {
          const session = sessions.find((item) => item.id === conversation.key);
          const sessionRunning = session?.runIds.some((runId) =>
            ["queued", "running", "waiting_tool"].includes(
              runs[runId]?.status ?? "",
            ),
          );
          return {
            items: [
              {
                key: "delete",
                label: "删除 Session",
                icon: <DeleteOutlined />,
                danger: true,
                disabled: sessions.length <= 1 || sessionRunning,
              },
            ],
            onClick: ({ key }) => {
              if (key === "delete" && session) {
                handleDelete(session.id, session.title);
              }
            },
          };
        }}
      />
    </nav>
  );

  return (
    <Drawer
      open={panelOpen}
      onClose={closePanel}
      placement={mobile ? "bottom" : "right"}
      size={mobile ? "72vh" : drawerSize}
      maxSize={mobile ? "90vh" : "80vw"}
      resizable={
        mobile
          ? false
          : { onResize: (size) => setDrawerSize(Math.max(420, size)) }
      }
      mask={false}
      rootStyle={{ overflow: "hidden" }}
      rootClassName={style.drawer}
      classNames={{
        section: style.drawerSection,
        body: style.drawerBody,
        header: style.drawerHeader,
      }}
      title={
        <div className={style.drawerTitle}>
          <img src={MPE_LOGO_URL} alt="" />
          <span>MPE Harness</span>
          <Tag color="blue" variant="filled" className={style.betaTag}>
            Infra BETA
          </Tag>
          <WikiAnchor
            path="10.工作流面板/70.MPE%20Harness.html"
            title="MPE Harness"
            description="AI 对话、流程探索与自动化编辑"
          />
        </div>
      }
      closeIcon={<CloseOutlined />}
    >
      <AIHarnessErrorBoundary>
        <div className={style.content}>
          <main className={style.conversation}>
          <div className={style.conversationHeader}>
            <Popover
              content={sessionSwitcher}
              trigger="click"
              placement="bottomLeft"
              arrow={false}
              open={sessionSwitcherOpen}
              onOpenChange={setSessionSwitcherOpen}
              classNames={{ container: style.sessionPopoverContainer }}
            >
              <Button
                type="text"
                className={style.sessionSwitcher}
                aria-label="切换 Session"
                icon={<HistoryOutlined />}
              >
                <span className={style.activeSessionTitle} title={activeSession?.title}>
                  {activeSession?.title}
                </span>
                <DownOutlined className={style.sessionSwitcherArrow} />
              </Button>
            </Popover>
            <Tooltip title="清空当前 Session" placement="left">
              <Button
                type="text"
                size="small"
                danger
                disabled={!activeSession?.runIds.length || isCurrentSessionRunning}
                aria-label="清空当前 Session"
                icon={<ClearOutlined />}
                onClick={handleClear}
              />
            </Tooltip>
          </div>

          <div className={style.messageList}>
            {sessionRuns.length === 0 ? (
              <section className={style.emptyState} aria-label="开始新对话">
                <Welcome
                  rootClassName={style.emptyWelcome}
                  classNames={{
                    title: style.emptyWelcomeTitle,
                    description: style.emptyWelcomeDescription,
                  }}
                  title={
                    <span className={style.emptyBrand}>
                      <img src={MPE_LOGO_URL} alt="MPE Harness" />
                      <span>从当前 Pipeline 开始</span>
                    </span>
                  }
                  description="询问流程逻辑，或直接让 Harness 帮你调整画布。"
                  variant="borderless"
                />
                <Prompts
                  rootClassName={style.starterPrompts}
                  classNames={{
                    list: style.starterPromptList,
                    item: style.starterPromptItem,
                    itemContent: style.starterPromptContent,
                  }}
                  items={STARTER_PROMPTS}
                  vertical
                  onItemClick={({ data }) => setDraft(String(data.label))}
                />
              </section>
            ) : (
              sessionRuns.map((run) => (
                <AIConversationRun
                  key={run.id}
                  run={run}
                  events={events[run.id] ?? []}
                  streamingText={activeRunId === run.id ? streamingText : ""}
                  streamingReasoning={
                    activeRunId === run.id ? streamingReasoning : ""
                  }
                />
              ))
            )}
          </div>

          <div className={style.composerShell} data-testid="ai-composer-shell">
            {commandMenuOpen ? (
              <div
                className={style.commandMenu}
                role="listbox"
                aria-label="Harness 命令"
              >
                {commandOptions.map((command, index) => (
                  <button
                    key={command.name}
                    type="button"
                    role="option"
                    aria-selected={index === activeCommandIndex}
                    className={`${style.commandItem} ${
                      index === activeCommandIndex
                        ? style.commandItemActive
                        : ""
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setDraft(`/${command.name} `)}
                  >
                    <span className={style.commandIcon}>/</span>
                    <span className={style.commandText}>
                      <strong>/{command.name}</strong>
                      <span>
                        {command.label} · {command.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className={style.composerActions}>
              <Button
                size="small"
                icon={<ApartmentOutlined />}
                aria-label="流程架构"
                disabled={nodeCount === 0 || isAnyRunRunning}
                onClick={() => void handleBusinessArchitecture()}
              >
                流程架构
              </Button>
              <Button
                size="small"
                icon={<PartitionOutlined />}
                aria-label="AI 重排"
                disabled={isAnyRunRunning || nodeCount === 0}
                onClick={() => void handleSemanticLayout()}
              >
                AI 重排
              </Button>
            </div>
            <Sender
              rootClassName={style.composer}
              value={draft}
              onChange={setDraft}
              onSubmit={(value) => void handleSend(value)}
              onKeyDown={handleCommandKeyDown}
              loading={isCurrentSessionRunning}
              onCancel={() => {
                if (activeRunId) harnessRunner.stop(activeRunId);
              }}
              autoSize={{ minRows: 1, maxRows: 5 }}
              styles={{ input: { fontSize: 14, lineHeight: "22px" } }}
              placeholder="输入目标或问题"
              disabled={isAnyRunRunning && !isCurrentSessionRunning}
            />
          </div>
          </main>
        </div>
      </AIHarnessErrorBoundary>
    </Drawer>
  );
}

export default memo(AIHistoryPanel);
