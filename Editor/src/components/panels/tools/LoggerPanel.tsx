import { useCallback, useEffect, useRef, useState } from "react";
import {
  DeleteOutlined,
  DownOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { App, Tooltip } from "antd";
import type { VirtualListHandle } from "@/components/common/VirtualList";
import { useLoggerStore } from "@/stores/app/loggerStore";
import { useOperationLogStore } from "@/stores/flow/operationLogStore";
import { useWSStore } from "@/stores/connection/wsStore";
import { useEmbedMessageLogStore } from "@/stores/embed/embedMessageLogStore";
import { useEmbedMode } from "../../../hooks/useEmbedMode";
import styles from "../../../styles/panels/LoggerPanel.module.less";
import { mfwProtocol } from "../../../services/server";
import { buildMPELogExportPayload } from "@/utils/logExportPayload";
import {
  BackendLogList,
  EmbedMessageLogList,
  OperationLogList,
  getCategoryClass,
  getCategoryIcon,
  getLevelClass,
  getLevelIcon,
  type LoggerTabType,
} from "./logger/LoggerVirtualLists";

const LOGGER_LIST_HEIGHT = 308;

interface TabScrollState {
  offset: number;
  atBottom: boolean;
}

function createInitialScrollState(): Record<LoggerTabType, TabScrollState> {
  return {
    operation: { offset: 0, atBottom: true },
    backend: { offset: 0, atBottom: true },
    embed: { offset: 0, atBottom: true },
  };
}

// ========== 主组件 ==========

export function LoggerPanel() {
  const { message } = App.useApp();
  const { logs: backendLogs, expanded, toggleExpanded, clearLogs: clearBackendLogs } =
    useLoggerStore();
  const { logs: opLogs, clearLogs: clearOpLogs } = useOperationLogStore();
  const connected = useWSStore((state) => state.connected);
  const embedLogs = useEmbedMessageLogStore((state) => state.logs);
  const clearEmbedLogs = useEmbedMessageLogStore((state) => state.clearLogs);
  const { isEmbed } = useEmbedMode();
  const listRef = useRef<VirtualListHandle>(null);
  const tabScrollStateRef = useRef(createInitialScrollState());
  const [pulse, setPulse] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<LoggerTabType>("operation");
  const latestOpId = opLogs.at(-1)?.id;
  const latestBackendId = backendLogs.at(-1)?.id;
  const latestEmbedId = embedLogs.at(-1)?.id;
  const prevOpIdRef = useRef(latestOpId);
  const prevBackendIdRef = useRef(latestBackendId);
  const prevEmbedIdRef = useRef(latestEmbedId);

  const currentLogs =
    activeTab === "operation"
      ? opLogs
      : activeTab === "backend"
        ? backendLogs
        : embedLogs;
  const currentLastLogId = currentLogs.at(-1)?.id;

  useEffect(() => {
    if (!expanded || !currentLastLogId) return;
    const scrollState = tabScrollStateRef.current[activeTab];
    if (!scrollState.atBottom) return;
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToEnd();
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, currentLastLogId, currentLogs.length, expanded]);

  useEffect(() => {
    if (latestOpId && latestOpId !== prevOpIdRef.current) {
      setActiveTab("operation");
      if (!expanded) {
        setPulse(true);
        const timer = setTimeout(() => setPulse(false), 1600);
        prevOpIdRef.current = latestOpId;
        return () => clearTimeout(timer);
      }
    }
    prevOpIdRef.current = latestOpId;
  }, [latestOpId, expanded]);

  useEffect(() => {
    if (latestBackendId && latestBackendId !== prevBackendIdRef.current) {
      if (connected) setActiveTab("backend");
      if (!expanded) {
        setPulse(true);
        const timer = setTimeout(() => setPulse(false), 1600);
        prevBackendIdRef.current = latestBackendId;
        return () => clearTimeout(timer);
      }
    }
    prevBackendIdRef.current = latestBackendId;
  }, [latestBackendId, expanded, connected]);

  useEffect(() => {
    if (isEmbed && latestEmbedId && latestEmbedId !== prevEmbedIdRef.current) {
      setActiveTab("embed");
      if (!expanded) {
        setPulse(true);
        const timer = setTimeout(() => setPulse(false), 1600);
        prevEmbedIdRef.current = latestEmbedId;
        return () => clearTimeout(timer);
      }
    }
    prevEmbedIdRef.current = latestEmbedId;
  }, [latestEmbedId, expanded, isEmbed]);

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
      tabScrollStateRef.current[activeTab] = {
        offset: scrollTop,
        atBottom: scrollHeight - scrollTop - clientHeight < 10,
      };
    },
    [activeTab],
  );

  useEffect(() => {
    if (!expanded) return;
    const scrollState = tabScrollStateRef.current[activeTab];
    const frame = requestAnimationFrame(() => {
      if (scrollState.atBottom && currentLogs.length > 0) {
        listRef.current?.scrollToEnd();
      } else {
        listRef.current?.scrollToOffset(scrollState.offset);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, currentLogs.length, expanded]);

  const handleTabChange = useCallback(
    (tab: LoggerTabType) => {
      if (tab === "backend" && !connected) return;
      if (tab === "embed" && !isEmbed) return;
      setActiveTab(tab);
    },
    [connected, isEmbed],
  );

  const handleClear = useCallback(() => {
    tabScrollStateRef.current[activeTab] = { offset: 0, atBottom: true };
    if (activeTab === "operation") {
      clearOpLogs();
    } else if (activeTab === "backend") {
      clearBackendLogs();
    } else {
      clearEmbedLogs();
    }
  }, [activeTab, clearOpLogs, clearBackendLogs, clearEmbedLogs]);

  const handleExport = useCallback(() => {
    if (!connected) {
      message.warning("未连接 LocalBridge，无法导出完整日志");
      return;
    }
    setExporting(true);
    const payload = buildMPELogExportPayload({
      backend: backendLogs,
      importantBackend: useLoggerStore.getState().importantLogs,
      operation: opLogs,
      embed: isEmbed ? embedLogs : [],
    });
    const sent = mfwProtocol.requestExportLogs(payload);
    if (!sent) {
      setExporting(false);
      message.error("发送日志导出请求失败");
    }
  }, [backendLogs, connected, embedLogs, isEmbed, message, opLogs]);

  useEffect(() => {
    return mfwProtocol.onLogsExported((data) => {
      setExporting(false);
      if (!data.success || !data.content) {
        message.error(data.message || "日志导出失败");
        return;
      }
      const bytes = Uint8Array.from(atob(data.content), (char) => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = data.filename || `mpe-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      message.success("日志导出成功");
    });
  }, [message]);

  const exportButton = !isEmbed ? (
    <Tooltip placement="right" title="导出 MPE 日志">
      <button
        className={styles.exportBtn}
        onClick={(event) => { event.stopPropagation(); handleExport(); }}
        disabled={exporting}
      >
        <DownloadOutlined spin={exporting} />
      </button>
    </Tooltip>
  ) : null;

  // 收起态最新条目（根据当前 activeTab 显示对应日志）
  const latestOpLog = opLogs.length > 0 ? opLogs[opLogs.length - 1] : null;
  const latestBackendLog =
    backendLogs.length > 0 ? backendLogs[backendLogs.length - 1] : null;
  const latestEmbedLog =
    embedLogs.length > 0 ? embedLogs[embedLogs.length - 1] : null;

  // 收起态
  if (!expanded) {
    return (
      <div
        className={`${styles.container} ${styles.collapsed}`}
        onClick={toggleExpanded}
      >
        <div className={`${styles.bar} ${pulse ? styles.barPulse : ""}`}>
          {activeTab === "operation" ? (
            latestOpLog ? (
              <>
                <span
                  className={`${styles.barIcon} ${getCategoryClass(latestOpLog.category)}`}
                >
                  {getCategoryIcon(latestOpLog.category)}
                </span>
                <span className={styles.barMessage}>
                  {latestOpLog.description}
                </span>
              </>
            ) : (
              <span className={styles.barMessage}>暂无操作记录</span>
            )
          ) : activeTab === "backend" && latestBackendLog ? (
            <>
              <span
                className={`${styles.barIcon} ${getLevelClass(latestBackendLog.level)}`}
              >
                {getLevelIcon(latestBackendLog.level)}
              </span>
              <span className={styles.barMessage}>
                {latestBackendLog.message}
              </span>
            </>
          ) : activeTab === "embed" && latestEmbedLog ? (
            <>
              <span className={`${styles.barIcon} ${styles.embedMessage}`}>
                {latestEmbedLog.direction === "incoming" ? (
                  <ArrowDownOutlined />
                ) : (
                  <ArrowUpOutlined />
                )}
              </span>
              <span className={styles.barMessage}>{latestEmbedLog.type}</span>
            </>
          ) : (
            <span className={styles.barMessage}>暂无日志</span>
          )}
        </div>
        {exportButton}
      </div>
    );
  }

  // 展开态
  return (
    <div className={`${styles.container} ${styles.expanded}`}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === "operation" ? styles.tabActive : ""}`}
              onClick={() => handleTabChange("operation")}
            >
              操作记录
            </button>
            <button
              className={`${styles.tab} ${activeTab === "backend" ? styles.tabActive : ""} ${!connected ? styles.tabDisabled : ""}`}
              onClick={() => handleTabChange("backend")}
              title={!connected ? "未连接 LocalBridge" : "后端日志"}
            >
              后端日志
            </button>
            {isEmbed && (
              <button
                className={`${styles.tab} ${activeTab === "embed" ? styles.tabActive : ""}`}
                onClick={() => handleTabChange("embed")}
              >
                嵌入通信
              </button>
            )}
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.headerBtn}
              onClick={handleClear}
              title="清空"
            >
              <DeleteOutlined />
            </button>
            <button
              className={styles.headerBtn}
              onClick={toggleExpanded}
              title="收起"
            >
              <DownOutlined />
            </button>
          </div>
        </div>
        {activeTab === "operation" ? (
          <OperationLogList
            ref={listRef}
            logs={opLogs}
            height={LOGGER_LIST_HEIGHT}
            onScroll={handleScroll}
          />
        ) : activeTab === "backend" ? (
          <BackendLogList
            ref={listRef}
            logs={backendLogs}
            height={LOGGER_LIST_HEIGHT}
            onScroll={handleScroll}
          />
        ) : (
          <EmbedMessageLogList
            ref={listRef}
            logs={embedLogs}
            height={LOGGER_LIST_HEIGHT}
            onScroll={handleScroll}
          />
        )}
      </div>
      {exportButton}
    </div>
  );
}
