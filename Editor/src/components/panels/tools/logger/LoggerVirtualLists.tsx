import {
  forwardRef,
  memo,
  useCallback,
  useState,
  type UIEventHandler,
} from "react";
import {
  AppstoreOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  BranchesOutlined,
  CloseCircleOutlined,
  GroupOutlined,
  InfoCircleOutlined,
  NodeIndexOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  VirtualList,
  type VirtualListHandle,
} from "@/components/common/VirtualList";
import { useFlowStore } from "@/stores/flow";
import { selectAndFitNodeIds } from "@/services/flowNavigationService";
import type { LogEntry } from "@/stores/app/loggerStore";
import type {
  OperationCategory,
  OperationLog,
} from "@/stores/flow/operationLogStore";
import type { EmbedMessageLog } from "@/stores/embed/embedMessageLogStore";
import styles from "@/styles/panels/LoggerPanel.module.less";

export type LoggerTabType = "operation" | "backend" | "embed";

export interface LoggerVirtualListProps {
  height: number;
  onScroll: UIEventHandler<HTMLElement>;
}

const PAYLOAD_CACHE_LIMIT = 200;
const payloadCache = new Map<string, { payload: unknown; formatted: string }>();

export function getLevelIcon(level: LogEntry["level"]) {
  switch (level) {
    case "INFO":
      return <InfoCircleOutlined />;
    case "WARN":
      return <WarningOutlined />;
    case "ERROR":
      return <CloseCircleOutlined />;
  }
}

export function getLevelClass(level: LogEntry["level"]) {
  switch (level) {
    case "INFO":
      return styles.levelInfo;
    case "WARN":
      return styles.levelWarn;
    case "ERROR":
      return styles.levelError;
  }
}

export function getCategoryIcon(category: OperationCategory) {
  switch (category) {
    case "node":
      return <NodeIndexOutlined />;
    case "edge":
      return <BranchesOutlined />;
    case "graph":
      return <AppstoreOutlined />;
    case "group":
      return <GroupOutlined />;
  }
}

export function getCategoryClass(category: OperationCategory) {
  switch (category) {
    case "node":
      return styles.categoryNode;
    case "edge":
      return styles.categoryEdge;
    case "graph":
      return styles.categoryGraph;
    case "group":
      return styles.categoryGroup;
  }
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("zh-CN", { hour12: false });
}

function formatISOTime(isoString: string) {
  const timestamp = Date.parse(isoString);
  return Number.isNaN(timestamp)
    ? ""
    : new Date(timestamp).toLocaleTimeString("zh-CN", { hour12: false });
}

function formatMessageTimestamp(timestamp: number) {
  return new Date(timestamp).toISOString().slice(11, 23);
}

function formatPayload(log: EmbedMessageLog): string {
  const cached = payloadCache.get(log.id);
  if (cached?.payload === log.payload) return cached.formatted;

  let formatted: string;
  try {
    formatted = JSON.stringify(log.payload, null, 2) ?? String(log.payload);
  } catch {
    formatted = String(log.payload);
  }

  if (payloadCache.size >= PAYLOAD_CACHE_LIMIT) {
    const oldestKey = payloadCache.keys().next().value;
    if (oldestKey) payloadCache.delete(oldestKey);
  }
  payloadCache.set(log.id, { payload: log.payload, formatted });
  return formatted;
}

function handleOperationLogClick(log: OperationLog) {
  if (!log.targetIds?.length) return;
  const state = useFlowStore.getState();
  selectAndFitNodeIds(log.targetIds, {
    delay: 100,
    duration: 500,
    minZoom: state.viewport.zoom,
    maxZoom: state.viewport.zoom,
  });
}

function EmptyLogList({ text, height }: { text: string; height: number }) {
  return (
    <div className={`${styles.logList} ${styles.empty}`} style={{ height }}>
      {text}
    </div>
  );
}

const EmbedPayload = memo(({ log }: { log: EmbedMessageLog }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <details
      className={styles.embedPayload}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>payload</summary>
      {expanded && <pre>{formatPayload(log)}</pre>}
    </details>
  );
});

EmbedPayload.displayName = "EmbedPayload";

export const EmbedMessageLogList = forwardRef<
  VirtualListHandle,
  LoggerVirtualListProps & { logs: EmbedMessageLog[] }
>(function EmbedMessageLogList({ logs, height, onScroll }, ref) {
  const renderItem = useCallback(
    (log: EmbedMessageLog) => (
      <div
        data-log-id={log.id}
        className={`${styles.logItem} ${styles.embedMessage}`}
      >
        <span className={styles.logIcon}>
          {log.direction === "incoming" ? (
            <ArrowDownOutlined />
          ) : (
            <ArrowUpOutlined />
          )}
        </span>
        <div className={styles.logContent}>
          <div className={styles.logMeta}>
            <span className={styles.logTime}>
              {formatMessageTimestamp(log.timestamp)}
            </span>
            <span className={styles.embedDirection}>
              {log.direction === "incoming" ? "接收" : "发送"}
            </span>
            <span className={styles.embedType}>{log.type}</span>
          </div>
          {(log.requestId || log.origin) && (
            <div className={styles.embedContext}>
              {log.requestId && <span>{log.requestId}</span>}
              {log.origin && <span>{log.origin}</span>}
            </div>
          )}
          <EmbedPayload log={log} />
        </div>
      </div>
    ),
    [],
  );

  if (logs.length === 0) {
    return <EmptyLogList text="暂无嵌入通信记录" height={height} />;
  }
  return (
    <VirtualList
      ref={ref}
      ariaLabel={`嵌入通信记录，共 ${logs.length} 条`}
      className={styles.logList}
      estimatedItemHeight={70}
      height={height}
      itemKey={(log) => `embed:${log.id}`}
      items={logs}
      onScroll={onScroll}
      renderItem={renderItem}
    />
  );
});

export const OperationLogList = forwardRef<
  VirtualListHandle,
  LoggerVirtualListProps & { logs: OperationLog[] }
>(function OperationLogList({ logs, height, onScroll }, ref) {
  const renderItem = useCallback(
    (log: OperationLog) => (
      <div
        data-log-id={log.id}
        className={`${styles.logItem} ${getCategoryClass(log.category)} ${
          log.targetIds?.length ? styles.clickable : ""
        }`}
        onClick={() => handleOperationLogClick(log)}
      >
        <span className={styles.logIcon}>{getCategoryIcon(log.category)}</span>
        <div className={styles.logContent}>
          <div className={styles.logMeta}>
            <span className={styles.logTime}>{formatTimestamp(log.timestamp)}</span>
          </div>
          <div className={styles.logMessage}>{log.description}</div>
        </div>
      </div>
    ),
    [],
  );

  if (logs.length === 0) {
    return <EmptyLogList text="暂无操作记录" height={height} />;
  }
  return (
    <VirtualList
      ref={ref}
      ariaLabel={`操作记录，共 ${logs.length} 条`}
      className={styles.logList}
      estimatedItemHeight={48}
      height={height}
      itemKey={(log) => `operation:${log.id}`}
      items={logs}
      onScroll={onScroll}
      renderItem={renderItem}
    />
  );
});

export const BackendLogList = forwardRef<
  VirtualListHandle,
  LoggerVirtualListProps & { logs: LogEntry[] }
>(function BackendLogList({ logs, height, onScroll }, ref) {
  const renderItem = useCallback(
    (log: LogEntry) => (
      <div
        data-log-id={log.id}
        className={`${styles.logItem} ${getLevelClass(log.level)}`}
      >
        <span className={styles.logIcon}>{getLevelIcon(log.level)}</span>
        <div className={styles.logContent}>
          <div className={styles.logMeta}>
            <span className={styles.logTime}>{formatISOTime(log.timestamp)}</span>
            <span className={styles.logModule}>{log.module}</span>
          </div>
          <div className={styles.logMessage}>{log.message}</div>
        </div>
      </div>
    ),
    [],
  );

  if (logs.length === 0) {
    return <EmptyLogList text="暂无日志" height={height} />;
  }
  return (
    <VirtualList
      ref={ref}
      ariaLabel={`后端日志，共 ${logs.length} 条`}
      className={styles.logList}
      estimatedItemHeight={48}
      height={height}
      itemKey={(log) => `backend:${log.id}`}
      items={logs}
      onScroll={onScroll}
      renderItem={renderItem}
    />
  );
});
