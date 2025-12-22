import { memo, useMemo } from "react";
import { Timeline, Tag, Empty, Image, Collapse, Statistic } from "antd";
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { useDebugStore } from "../../stores/debugStore";
import debugStyle from "../../styles/DebugPanel.module.less";

/**
 * 调试信息标签页
 * 显示执行历史记录、识别结果、截图等详细信息
 */
function DebugInfoTab() {
  const {
    debugStatus,
    taskId,
    currentNode,
    executionHistory,
    executionStartTime,
  } = useDebugStore((state) => ({
    debugStatus: state.debugStatus,
    taskId: state.taskId,
    currentNode: state.currentNode,
    executionHistory: state.executionHistory,
    executionStartTime: state.executionStartTime,
  }));

  // 计算执行时间
  const executionTime = useMemo(() => {
    if (!executionStartTime) return null;
    const now = Date.now();
    const elapsed = Math.floor((now - executionStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [executionStartTime, debugStatus]);

  // 生成时间轴项
  const timelineItems = useMemo(() => {
    return executionHistory.map((record, index) => {
      const isRunning = record.status === "running";
      const isCompleted = record.status === "completed";
      const isFailed = record.status === "failed";

      // 计算耗时
      const duration = record.endTime
        ? ((record.endTime - record.startTime) / 1000).toFixed(2)
        : null;

      // 时间轴项的图标和颜色
      const dot = isRunning ? (
        <ClockCircleOutlined style={{ fontSize: 16 }} />
      ) : isCompleted ? (
        <CheckCircleOutlined style={{ fontSize: 16 }} />
      ) : (
        <CloseCircleOutlined style={{ fontSize: 16 }} />
      );

      const color = isRunning ? "blue" : isCompleted ? "green" : "red";

      // 时间轴项内容
      return {
        key: `${record.nodeId}-${index}`,
        color,
        dot,
        children: (
          <Collapse
            ghost
            size="small"
            items={[
              {
                key: record.nodeId,
                label: (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span style={{ fontWeight: 500 }}>{record.nodeName}</span>
                    <Tag color={color} style={{ margin: 0 }}>
                      {record.status === "running"
                        ? "执行中"
                        : record.status === "completed"
                        ? "已完成"
                        : "失败"}
                    </Tag>
                    {duration && (
                      <span style={{ fontSize: 12, color: "#999" }}>
                        {duration}s
                      </span>
                    )}
                  </div>
                ),
                children: (
                  <div style={{ paddingLeft: 8 }}>
                    {/* 执行时间信息 */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: "#666" }}>
                        开始时间:{" "}
                        {new Date(record.startTime).toLocaleTimeString()}
                      </div>
                      {record.endTime && (
                        <div style={{ fontSize: 12, color: "#666" }}>
                          结束时间:{" "}
                          {new Date(record.endTime).toLocaleTimeString()}
                        </div>
                      )}
                    </div>

                    {/* 识别结果 */}
                    {record.recognition && (
                      <div style={{ marginBottom: 12 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            marginBottom: 4,
                          }}
                        >
                          识别结果
                        </div>
                        <div
                          style={{
                            padding: 8,
                            background: "#f5f5f5",
                            borderRadius: 4,
                            fontSize: 12,
                          }}
                        >
                          <div>算法: {record.recognition.algorithm}</div>
                          {record.recognition.result && (
                            <div>
                              结果:{" "}
                              {typeof record.recognition.result === "string"
                                ? record.recognition.result
                                : JSON.stringify(record.recognition.result)}
                            </div>
                          )}
                          {record.recognition.score !== undefined && (
                            <div>
                              置信度:{" "}
                              {(record.recognition.score * 100).toFixed(1)}%
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 动作结果 */}
                    {record.action && (
                      <div style={{ marginBottom: 12 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            marginBottom: 4,
                          }}
                        >
                          动作结果
                        </div>
                        <div
                          style={{
                            padding: 8,
                            background: "#f5f5f5",
                            borderRadius: 4,
                            fontSize: 12,
                          }}
                        >
                          <div>类型: {record.action.type}</div>
                          {record.action.target && (
                            <div>
                              目标:{" "}
                              {typeof record.action.target === "string"
                                ? record.action.target
                                : JSON.stringify(record.action.target)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 截图 */}
                    {record.screenshot && (
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            marginBottom: 4,
                          }}
                        >
                          截图
                        </div>
                        <Image
                          src={`data:image/png;base64,${record.screenshot}`}
                          alt="节点执行截图"
                          style={{
                            maxWidth: "100%",
                            borderRadius: 4,
                            border: "1px solid #d9d9d9",
                          }}
                        />
                      </div>
                    )}

                    {/* 错误信息 */}
                    {record.error && (
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            marginBottom: 4,
                            color: "#ff4d4f",
                          }}
                        >
                          错误信息
                        </div>
                        <div
                          style={{
                            padding: 8,
                            background: "#fff2f0",
                            borderRadius: 4,
                            fontSize: 12,
                            color: "#ff4d4f",
                          }}
                        >
                          {record.error}
                        </div>
                      </div>
                    )}
                  </div>
                ),
              },
            ]}
          />
        ),
      };
    });
  }, [executionHistory]);

  // 无调试会话时的提示
  if (debugStatus === "idle") {
    return (
      <div style={{ padding: 20 }}>
        <Empty
          description="暂无调试会话"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div
      className={debugStyle["debug-info-tab"]}
      style={{ padding: "12px 16px" }}
    >
      {/* 调试会话概览 */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Tag
            color={
              debugStatus === "running"
                ? "processing"
                : debugStatus === "paused"
                ? "warning"
                : debugStatus === "completed"
                ? "success"
                : "default"
            }
          >
            {debugStatus === "preparing"
              ? "准备中"
              : debugStatus === "running"
              ? "运行中"
              : debugStatus === "paused"
              ? "已暂停"
              : "已完成"}
          </Tag>
          {taskId && (
            <span style={{ fontSize: 12, color: "#999" }}>
              Task ID: {taskId.substring(0, 8)}...
            </span>
          )}
        </div>

        {/* 统计信息 */}
        <div style={{ display: "flex", gap: 16 }}>
          <Statistic
            title="已执行节点"
            value={
              executionHistory.filter((r) => r.status !== "running").length
            }
            suffix={`/ ${executionHistory.length}`}
            valueStyle={{ fontSize: 20 }}
          />
          {executionTime && (
            <Statistic
              title="执行时间"
              value={executionTime}
              valueStyle={{ fontSize: 20 }}
            />
          )}
        </div>
      </div>

      {/* 执行历史时间轴 */}
      <div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            marginBottom: 12,
            color: "#262626",
          }}
        >
          执行历史
        </div>
        {timelineItems.length > 0 ? (
          <Timeline items={timelineItems} />
        ) : (
          <Empty
            description="暂无执行记录"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </div>
    </div>
  );
}

export default memo(DebugInfoTab);
