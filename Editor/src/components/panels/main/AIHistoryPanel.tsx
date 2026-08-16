import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App as AntdApp, Button, Drawer, Empty, Input, Tooltip } from "antd";
import {
  ClearOutlined,
  CloseOutlined,
  DeleteOutlined,
  MessageOutlined,
  PlusOutlined,
  SendOutlined,
  StopOutlined,
} from "@ant-design/icons";
import classNames from "classnames";

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

const { TextArea } = Input;
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
  const messageListRef = useRef<HTMLDivElement>(null);
  const show = useConfigStore((state) => state.status.showAIHistoryPanel);
  const setStatus = useConfigStore((state) => state.setStatus);
  const sessions = useAIHarnessStore((state) => state.sessions);
  const activeSessionId = useAIHarnessStore((state) => state.activeSessionId);
  const runs = useAIHarnessStore((state) => state.runs);
  const events = useAIHarnessStore((state) => state.events);
  const activeRunId = useAIHarnessStore((state) => state.activeRunId);
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
  const isAnyRunRunning = Boolean(currentRun);

  useEffect(() => {
    messageListRef.current?.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [sessionRuns.length, streamingText, activeSessionId]);

  const handleSend = useCallback(async () => {
    const goal = draft.trim();
    if (!goal || isAnyRunRunning) return;
    setDraft("");
    try {
      await harnessRunner.start(goal, activeSessionId);
    } catch (error) {
      setDraft(goal);
      message.error(error instanceof Error ? error.message : "无法启动 AI Run");
    }
  }, [activeSessionId, draft, isAnyRunRunning, message]);

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
      classNames={{ body: style.drawerBody, header: style.drawerHeader }}
      title={
        <div className={style.drawerTitle}>
          <MessageOutlined />
          <span>AI 对话</span>
        </div>
      }
      closeIcon={<CloseOutlined />}
    >
      <div className={style.content}>
        <aside className={style.sessionSidebar} aria-label="AI Session 列表">
          <div className={style.sessionHeader}>
            <span>Session</span>
            <Tooltip title="新建 Session">
              <Button
                type="text"
                size="small"
                aria-label="新建 Session"
                icon={<PlusOutlined />}
                onClick={() => createSession()}
              />
            </Tooltip>
          </div>
          <div className={style.sessionList}>
            {sessions.map((session) => {
              const active = session.id === activeSessionId;
              const sessionRunning = session.runIds.some((runId) =>
                ["queued", "running", "waiting_tool"].includes(
                  runs[runId]?.status ?? "",
                ),
              );
              return (
                <div
                  key={session.id}
                  className={classNames(style.sessionItem, {
                    [style.sessionItemActive]: active,
                  })}
                  role="button"
                  tabIndex={0}
                  onClick={() => switchSession(session.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      switchSession(session.id);
                    }
                  }}
                >
                  <div className={style.sessionItemMain}>
                    <div className={style.sessionTitle} title={session.title}>
                      {session.title}
                    </div>
                    <div className={style.sessionMeta}>
                      <span>{session.runIds.length} Runs</span>
                      <span>{formatAIConversationTime(session.updatedAt)}</span>
                    </div>
                  </div>
                  <Tooltip
                    title={
                      sessions.length <= 1
                        ? "至少保留一个 Session"
                        : sessionRunning
                          ? "运行中不可删除"
                          : "删除 Session"
                    }
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      disabled={sessions.length <= 1 || sessionRunning}
                      aria-label={`删除 ${session.title}`}
                      icon={<DeleteOutlined />}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(session.id, session.title);
                      }}
                    />
                  </Tooltip>
                </div>
              );
            })}
          </div>
        </aside>

        <main className={style.conversation}>
          <div className={style.conversationHeader}>
            <span title={activeSession?.title}>{activeSession?.title}</span>
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

          <div ref={messageListRef} className={style.messageList}>
            {sessionRuns.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无对话" />
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

          <div className={style.composer}>
            <TextArea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onPressEnter={(event) => {
                if (!event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              autoSize={{ minRows: 2, maxRows: 6 }}
              placeholder="输入目标或问题"
              disabled={isAnyRunRunning}
            />
            <div className={style.composerActions}>
              {isCurrentSessionRunning && activeRunId ? (
                <Tooltip title="停止 Run">
                  <Button
                    danger
                    aria-label="停止 Run"
                    icon={<StopOutlined />}
                    onClick={() => harnessRunner.stop(activeRunId)}
                  />
                </Tooltip>
              ) : (
                <Tooltip title="发送">
                  <Button
                    type="primary"
                    aria-label="发送"
                    icon={<SendOutlined />}
                    disabled={!draft.trim() || isAnyRunRunning}
                    onClick={() => void handleSend()}
                  />
                </Tooltip>
              )}
            </div>
          </div>
        </main>
      </div>
    </Drawer>
  );
}

export default memo(AIHistoryPanel);
