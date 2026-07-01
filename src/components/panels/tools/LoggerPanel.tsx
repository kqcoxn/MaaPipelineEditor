import { useCallback, useEffect, useRef, useState } from "react";
import {
  InfoCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  DownOutlined,
  NodeIndexOutlined,
  BranchesOutlined,
  AppstoreOutlined,
  GroupOutlined,
} from "@ant-design/icons";
import { useLoggerStore, type LogEntry } from "../../../stores/loggerStore";
import {
  useOperationLogStore,
  type OperationLog,
  type OperationCategory,
} from "../../../stores/operationLogStore";
import { useWSStore } from "../../../stores/wsStore";
import { useFlowStore, findNodeById, fitFlowView } from "../../../stores/flow";
import styles from "../../../styles/panels/LoggerPanel.module.less";

type TabType = "operation" | "backend";

// ========== 后端日志工具函数 ==========

const getLevelIcon = (level: LogEntry["level"]) => {
  switch (level) {
    case "INFO":
      return <InfoCircleOutlined />;
    case "WARN":
      return <WarningOutlined />;
    case "ERROR":
      return <CloseCircleOutlined />;
  }
};

const getLevelClass = (level: LogEntry["level"]) => {
  switch (level) {
    case "INFO":
      return styles.levelInfo;
    case "WARN":
      return styles.levelWarn;
    case "ERROR":
      return styles.levelError;
  }
};

// ========== 操作日志工具函数 ==========

const getCategoryIcon = (category: OperationCategory) => {
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
};

const getCategoryClass = (category: OperationCategory) => {
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
};

const formatTimestamp = (ts: number) => {
  const date = new Date(ts);
  return date.toLocaleTimeString("zh-CN", { hour12: false });
};

const formatISOTime = (isoString: string) => {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString("zh-CN", { hour12: false });
  } catch {
    return "";
  }
};

// ========== 操作日志跳转 ==========

function handleOperationLogClick(log: OperationLog) {
  if (!log.targetIds || log.targetIds.length === 0) return;

  const state = useFlowStore.getState();
  const targetNodes = log.targetIds
    .map((id) => findNodeById(state.nodes, id))
    .filter(Boolean);

  if (targetNodes.length === 0) return;

  // 选中目标节点
  state.updateSelection(targetNodes as any[], []);
  // 聚焦视图
  fitFlowView(state.instance, state.viewport, {
    focusNodes: targetNodes as any[],
  });
}

// ========== 主组件 ==========

export function LoggerPanel() {
  const { logs: backendLogs, expanded, toggleExpanded, clearLogs: clearBackendLogs } =
    useLoggerStore();
  const { logs: opLogs, clearLogs: clearOpLogs } = useOperationLogStore();
  const connected = useWSStore((state) => state.connected);
  const listRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [pulse, setPulse] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("operation");
  const prevOpLenRef = useRef(opLogs.length);
  const prevBackendLenRef = useRef(backendLogs.length);

  const currentLogs = activeTab === "operation" ? opLogs : backendLogs;

  // 自动滚动到底部
  useEffect(() => {
    if (expanded && autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [currentLogs, expanded, autoScroll]);

  // 新操作日志到达时自动切换到操作记录 tab
  useEffect(() => {
    if (opLogs.length > prevOpLenRef.current) {
      setActiveTab("operation");
      if (!expanded) {
        setPulse(true);
        const timer = setTimeout(() => setPulse(false), 1600);
        return () => clearTimeout(timer);
      }
      setAutoScroll(true);
    }
    prevOpLenRef.current = opLogs.length;
  }, [opLogs.length, expanded]);

  // 新后端日志到达时自动切换到后端日志 tab
  useEffect(() => {
    if (backendLogs.length > prevBackendLenRef.current) {
      if (connected) {
        setActiveTab("backend");
      }
      if (!expanded) {
        setPulse(true);
        const timer = setTimeout(() => setPulse(false), 1600);
        return () => clearTimeout(timer);
      }
      setAutoScroll(true);
    }
    prevBackendLenRef.current = backendLogs.length;
  }, [backendLogs.length, expanded, connected]);

  // 监听滚动事件
  const handleScroll = () => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
    setAutoScroll(isAtBottom);
  };

  // 展开时重置自动滚动
  useEffect(() => {
    if (expanded) {
      setAutoScroll(true);
    }
  }, [expanded]);

  // 切换 tab
  const handleTabChange = useCallback(
    (tab: TabType) => {
      if (tab === "backend" && !connected) return;
      setActiveTab(tab);
      setAutoScroll(true);
    },
    [connected],
  );

  // 清空当前 tab 日志
  const handleClear = useCallback(() => {
    if (activeTab === "operation") {
      clearOpLogs();
    } else {
      clearBackendLogs();
    }
  }, [activeTab, clearOpLogs, clearBackendLogs]);

  // 收起态最新条目（根据当前 activeTab 显示对应日志）
  const latestOpLog = opLogs.length > 0 ? opLogs[opLogs.length - 1] : null;
  const latestBackendLog =
    backendLogs.length > 0 ? backendLogs[backendLogs.length - 1] : null;

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
          ) : latestBackendLog ? (
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
          ) : (
            <span className={styles.barMessage}>暂无日志</span>
          )}
        </div>
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
        <div ref={listRef} className={styles.logList} onScroll={handleScroll}>
          {activeTab === "operation" ? (
            <OperationLogList logs={opLogs} />
          ) : (
            <BackendLogList logs={backendLogs} />
          )}
        </div>
      </div>
    </div>
  );
}

// ========== 子组件 ==========

function OperationLogList({ logs }: { logs: OperationLog[] }) {
  if (logs.length === 0) {
    return <div className={styles.empty}>暂无操作记录</div>;
  }

  return (
    <>
      {logs.map((log) => (
        <div
          key={log.id}
          className={`${styles.logItem} ${getCategoryClass(log.category)} ${log.targetIds?.length ? styles.clickable : ""}`}
          onClick={() => handleOperationLogClick(log)}
        >
          <span className={styles.logIcon}>
            {getCategoryIcon(log.category)}
          </span>
          <div className={styles.logContent}>
            <div className={styles.logMeta}>
              <span className={styles.logTime}>
                {formatTimestamp(log.timestamp)}
              </span>
            </div>
            <div className={styles.logMessage}>{log.description}</div>
          </div>
        </div>
      ))}
    </>
  );
}

function BackendLogList({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0) {
    return <div className={styles.empty}>暂无日志</div>;
  }

  return (
    <>
      {logs.map((log) => (
        <div
          key={log.id}
          className={`${styles.logItem} ${getLevelClass(log.level)}`}
        >
          <span className={styles.logIcon}>{getLevelIcon(log.level)}</span>
          <div className={styles.logContent}>
            <div className={styles.logMeta}>
              <span className={styles.logTime}>
                {formatISOTime(log.timestamp)}
              </span>
              <span className={styles.logModule}>{log.module}</span>
            </div>
            <div className={styles.logMessage}>{log.message}</div>
          </div>
        </div>
      ))}
    </>
  );
}
