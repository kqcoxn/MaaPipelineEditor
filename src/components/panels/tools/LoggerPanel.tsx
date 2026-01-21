import { useEffect, useRef, useState } from "react";
import {
  InfoCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  DownOutlined,
} from "@ant-design/icons";
import { useLoggerStore, type LogEntry } from "../../../stores/loggerStore";
import { useWSStore } from "../../../stores/wsStore";
import styles from "../../../styles/LoggerPanel.module.less";

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

const getBarIconClass = (level: LogEntry["level"]) => {
  switch (level) {
    case "INFO":
      return styles.barIconInfo;
    case "WARN":
      return styles.barIconWarn;
    case "ERROR":
      return styles.barIconError;
  }
};

const formatTime = (isoString: string) => {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString("zh-CN", { hour12: false });
  } catch {
    return "";
  }
};

export function LoggerPanel() {
  const { logs, expanded, toggleExpanded, clearLogs } = useLoggerStore();
  const connected = useWSStore((state) => state.connected);
  const listRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [pulse, setPulse] = useState(false);
  const prevLogsLengthRef = useRef(logs.length);

  // 自动滚动到底部
  useEffect(() => {
    if (expanded && autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [logs, expanded, autoScroll]);

  // 新日志到达时触发脉冲动画（收起态）
  useEffect(() => {
    if (!expanded && logs.length > prevLogsLengthRef.current) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 1600);
      return () => clearTimeout(timer);
    }
    prevLogsLengthRef.current = logs.length;
  }, [logs.length, expanded]);

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

  // 未连接时不显示
  if (!connected) {
    return null;
  }

  const latestLog = logs.length > 0 ? logs[logs.length - 1] : null;

  // 收起态
  if (!expanded) {
    return (
      <div
        className={`${styles.container} ${styles.collapsed}`}
        onClick={toggleExpanded}
      >
        <div className={`${styles.bar} ${pulse ? styles.barPulse : ""}`}>
          {latestLog ? (
            <>
              <span
                className={`${styles.barIcon} ${getBarIconClass(
                  latestLog.level
                )}`}
              >
                {getLevelIcon(latestLog.level)}
              </span>
              <span className={styles.barModule}>{latestLog.module}</span>
              <span className={styles.barMessage}>{latestLog.message}</span>
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
          <span className={styles.title}>后端日志</span>
          <div className={styles.headerActions}>
            <button
              className={styles.headerBtn}
              onClick={clearLogs}
              title="清空日志"
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
          {logs.length === 0 ? (
            <div className={styles.empty}>暂无日志</div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={`${styles.logItem} ${getLevelClass(log.level)}`}
              >
                <span className={styles.logIcon}>
                  {getLevelIcon(log.level)}
                </span>
                <div className={styles.logContent}>
                  <div className={styles.logMeta}>
                    <span className={styles.logTime}>
                      {formatTime(log.timestamp)}
                    </span>
                    <span className={styles.logModule}>{log.module}</span>
                  </div>
                  <div className={styles.logMessage}>{log.message}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
