import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { App as AntdApp, Button, Drawer, Popover, Tooltip } from "antd";
import { Conversations, Sender, Welcome } from "@ant-design/x";
import {
  ClearOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownOutlined,
  HistoryOutlined,
  MessageOutlined,
} from "@ant-design/icons";

import {
  harnessRunner,
  type HarnessRun,
  useAIHarnessStore,
} from "@/features/ai-harness";
import { useConfigStore } from "@/stores/app/configStore";
import {
  AIConversationRun,
  formatAIConversationTime,
} from "./AIConversationRun";
import style from "../../../styles/panels/AIHistoryPanel.module.less";

const MOBILE_QUERY = "(max-width: 720px)";

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
  const { modal, message } = AntdApp.useApp();
  const mobile = useMobileDrawer();
  const [draft, setDraft] = useState("");
  const [drawerSize, setDrawerSize] = useState(620);
  const [sessionSwitcherOpen, setSessionSwitcherOpen] = useState(false);
  const show = useConfigStore((state) => state.status.showAIHistoryPanel);
  const setStatus = useConfigStore((state) => state.setStatus);
  const sessions = useAIHarnessStore((state) => state.sessions);
  const activeSessionId = useAIHarnessStore((state) => state.activeSessionId);
  const runs = useAIHarnessStore((state) => state.runs);
  const events = useAIHarnessStore((state) => state.events);
  const activeRunId = useAIHarnessStore((state) => state.activeRunId);
  const pendingRunSessionId = useAIHarnessStore(
    (state) => state.pendingRunSessionId,
  );
  const streamingText = useAIHarnessStore((state) => state.streamingText);
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
    try {
      await harnessRunner.start(goal, activeSessionId);
    } catch (error) {
      setDraft(goal);
      message.error(error instanceof Error ? error.message : "无法启动 AI Run");
    }
  }, [activeSessionId, isAnyRunRunning, message]);

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
      open={show}
      onClose={() => setStatus("showAIHistoryPanel", false)}
      placement={mobile ? "bottom" : "right"}
      size={mobile ? "72vh" : drawerSize}
      maxSize={mobile ? "90vh" : "80vw"}
      resizable={
        mobile
          ? false
          : { onResize: (size) => setDrawerSize(Math.max(420, size)) }
      }
      mask={false}
      rootClassName={style.drawer}
      classNames={{
        section: style.drawerSection,
        body: style.drawerBody,
        header: style.drawerHeader,
      }}
      title={
        <div className={style.drawerTitle}>
          <MessageOutlined />
          <span>AI 对话</span>
        </div>
      }
      closeIcon={<CloseOutlined />}
    >
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
            <Tooltip title="清空当前 Session">
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
              <Welcome title="暂无对话" variant="borderless" />
            ) : (
              sessionRuns.map((run) => (
                <AIConversationRun
                  key={run.id}
                  run={run}
                  events={events[run.id] ?? []}
                  streamingText={activeRunId === run.id ? streamingText : ""}
                />
              ))
            )}
          </div>

          <div className={style.composerShell} data-testid="ai-composer-shell">
            <Sender
              rootClassName={style.composer}
              value={draft}
              onChange={setDraft}
              onSubmit={(value) => void handleSend(value)}
              loading={isCurrentSessionRunning}
              onCancel={() => {
                if (activeRunId) harnessRunner.stop(activeRunId);
              }}
              autoSize={{ minRows: 1, maxRows: 5 }}
              placeholder="输入目标或问题"
              disabled={isAnyRunRunning && !isCurrentSessionRunning}
            />
          </div>
        </main>
      </div>
    </Drawer>
  );
}

export default memo(AIHistoryPanel);
