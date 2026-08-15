import { useCallback, useSyncExternalStore, memo } from "react";
import { App as AntdApp, Badge, Button, Empty, Tooltip } from "antd";
import {
  ClearOutlined,
  CloseOutlined,
  DeleteOutlined,
  HistoryOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import classNames from "classnames";

import { useConfigStore } from "@/stores/app/configStore";
import { aiHistoryManager, type AIHistorySession } from "@/utils/ai/history";
import AIHistoryRecordItem, {
  formatDateTime,
} from "./AIHistoryRecordItem";
import style from "../../../styles/panels/AIHistoryPanel.module.less";

const subscribe = (listener: () => void) => aiHistoryManager.subscribe(listener);
const getSnapshot = () => aiHistoryManager.getSnapshot();

function formatSessionTime(session: AIHistorySession): string {
  if (session.records.length === 0) return "暂无记录";
  return formatDateTime(session.updatedAt);
}

function AIHistoryPanel() {
  const { modal } = AntdApp.useApp();
  const showAIHistoryPanel = useConfigStore(
    (state) => state.status.showAIHistoryPanel,
  );
  const setStatus = useConfigStore((state) => state.setStatus);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const activeSession = snapshot.sessions.find(
    (session) => session.id === snapshot.activeSessionId,
  );

  const handleCreateSession = useCallback(() => {
    aiHistoryManager.createSession();
  }, []);

  const handleClearSession = useCallback(() => {
    if (!activeSession || activeSession.records.length === 0) return;

    modal.confirm({
      title: "清空当前 Session？",
      content: "该 Session 中的所有对话记录会从内存中移除，无法恢复。",
      okText: "清空",
      okType: "danger",
      cancelText: "取消",
      onOk: () => aiHistoryManager.clearSession(activeSession.id),
    });
  }, [activeSession, modal]);

  const handleDeleteSession = useCallback((session: AIHistorySession) => {
    if (snapshot.sessions.length <= 1) return;

    modal.confirm({
      title: `删除「${session.title}」？`,
      content: "该 Session 中的对话记录会从内存中移除，无法恢复。",
      okText: "删除",
      okType: "danger",
      cancelText: "取消",
      onOk: () => aiHistoryManager.deleteSession(session.id),
    });
  }, [modal, snapshot.sessions.length]);

  const panelClass = classNames("panel-base", style.panel, {
    "panel-show": showAIHistoryPanel,
  });

  return (
    <section className={panelClass} aria-label="AI 对话历史">
      <header className={style.header}>
        <div className={style.title}>
          <HistoryOutlined />
          <span>AI 对话历史</span>
        </div>
        <Tooltip title="关闭">
          <Button
            type="text"
            size="small"
            aria-label="关闭 AI 对话历史"
            icon={<CloseOutlined />}
            onClick={() => setStatus("showAIHistoryPanel", false)}
          />
        </Tooltip>
      </header>

      <div className={style.content}>
        <aside className={style.sessionSidebar} aria-label="AI 会话列表">
          <div className={style.sessionHeader}>
            <span>Session</span>
            <Tooltip title="新建 Session">
              <Button
                type="text"
                size="small"
                aria-label="新建 Session"
                icon={<PlusOutlined />}
                onClick={handleCreateSession}
              />
            </Tooltip>
          </div>

          <div className={style.sessionList}>
            {snapshot.sessions.map((session) => {
              const isActive = session.id === snapshot.activeSessionId;
              return (
                <div
                  key={session.id}
                  className={classNames(style.sessionItem, {
                    [style.sessionItemActive]: isActive,
                  })}
                  role="button"
                  tabIndex={0}
                  onClick={() => aiHistoryManager.setActiveSession(session.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      aiHistoryManager.setActiveSession(session.id);
                    }
                  }}
                >
                  <div className={style.sessionItemMain}>
                    <div className={style.sessionTitle} title={session.title}>
                      {session.title}
                    </div>
                    <div className={style.sessionMeta}>
                      <span>{session.records.length} 轮</span>
                      <span>{formatSessionTime(session)}</span>
                    </div>
                  </div>
                  <Tooltip
                    title={
                      snapshot.sessions.length <= 1
                        ? "至少保留一个 Session"
                        : "删除 Session"
                    }
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      disabled={snapshot.sessions.length <= 1}
                      aria-label={`删除 ${session.title}`}
                      icon={<DeleteOutlined />}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteSession(session);
                      }}
                    />
                  </Tooltip>
                </div>
              );
            })}
          </div>
        </aside>

        <main className={style.recordPane}>
          {activeSession && (
            <>
              <div className={style.recordHeader}>
                <div className={style.recordTitle}>
                  <span title={activeSession.title}>{activeSession.title}</span>
                  <Badge count={activeSession.records.length} showZero />
                </div>
                <Tooltip title="清空当前 Session">
                  <Button
                    type="text"
                    size="small"
                    danger
                    disabled={activeSession.records.length === 0}
                    aria-label="清空当前 Session"
                    icon={<ClearOutlined />}
                    onClick={handleClearSession}
                  />
                </Tooltip>
              </div>
              <div className={style.recordList}>
                {activeSession.records.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="暂无对话记录"
                  />
                ) : (
                  activeSession.records.map((record) => (
                    <AIHistoryRecordItem key={record.id} record={record} />
                  ))
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </section>
  );
}

export default memo(AIHistoryPanel);
