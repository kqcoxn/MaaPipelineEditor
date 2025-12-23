import { memo, useMemo } from "react";
import { Timeline, Tag, Empty, Image, Collapse, Statistic } from "antd";
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { useDebugStore } from "../../stores/debugStore";
import { useFlowStore } from "../../stores/flow";
import debugStyle from "../../styles/DebugPanel.module.less";

/**
 * 调试信息标签页
 * 显示执行历史记录、识别结果、截图等详细信息
 */
function DebugInfoTab() {
  // 获取状态
  const debugStatus = useDebugStore((state) => state.debugStatus);
  const taskId = useDebugStore((state) => state.taskId);
  const executionHistory = useDebugStore((state) => state.executionHistory);
  const executionStartTime = useDebugStore((state) => state.executionStartTime);

  // 获取当前选中的节点
  const selectedNode = useFlowStore((state) => state.targetNode);
  const selectedNodeId = selectedNode?.id || null;

  // 过滤出当前选中节点的执行历史
  const nodeExecutionHistory = useMemo(() => {
    if (!selectedNodeId) return [];
    const filtered = executionHistory.filter(
      (record) => record.nodeId === selectedNodeId
    );
    return filtered;
  }, [executionHistory, selectedNodeId]);

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
    return nodeExecutionHistory.map((record, index) => {
      const isRunning = record.status === "running";
      const isCompleted = record.status === "completed";

      // 计算耗时
      const durationMs = record.latency
        ? record.latency
        : record.endTime
        ? record.endTime - record.startTime
        : null;
      const duration =
        durationMs !== null ? (durationMs / 1000).toFixed(2) : null;

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
                key: `collapse-${record.nodeId}-${index}`,
                label: (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span style={{ fontWeight: 500 }}>
                      {record.nodeName}
                      {record.runIndex && record.runIndex > 1 && (
                        <span
                          style={{ fontSize: 11, color: "#999", marginLeft: 4 }}
                        >
                          (#{record.runIndex})
                        </span>
                      )}
                    </span>
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
                            background: record.recognition.success
                              ? "#f6ffed"
                              : "#fff2f0",
                            borderRadius: 4,
                            fontSize: 12,
                          }}
                        >
                          <div>
                            状态:{" "}
                            <Tag
                              color={
                                record.recognition.success ? "success" : "error"
                              }
                              style={{ marginLeft: 4 }}
                            >
                              {record.recognition.success ? "成功" : "失败"}
                            </Tag>
                          </div>
                          {record.recognition.detail && (
                            <div style={{ marginTop: 4 }}>
                              详情:{" "}
                              {typeof record.recognition.detail === "string"
                                ? record.recognition.detail
                                : JSON.stringify(
                                    record.recognition.detail,
                                    null,
                                    2
                                  )}
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
                            background: record.action.success
                              ? "#f6ffed"
                              : "#fff2f0",
                            borderRadius: 4,
                            fontSize: 12,
                          }}
                        >
                          <div>
                            状态:{" "}
                            <Tag
                              color={
                                record.action.success ? "success" : "error"
                              }
                              style={{ marginLeft: 4 }}
                            >
                              {record.action.success ? "成功" : "失败"}
                            </Tag>
                          </div>
                          {record.action.detail && (
                            <div style={{ marginTop: 4 }}>
                              详情:{" "}
                              {typeof record.action.detail === "string"
                                ? record.action.detail
                                : JSON.stringify(record.action.detail, null, 2)}
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
  }, [nodeExecutionHistory]);

  // 无调试会话时的提示
  if (debugStatus === "idle" && executionHistory.length === 0) {
    return (
      <div style={{ padding: 20 }}>
        <Empty
          description="暂无调试会话"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  // 当前节点未参与调试时的提示
  if (nodeExecutionHistory.length === 0 && selectedNodeId) {
    return (
      <div style={{ padding: 20 }}>
        <Empty
          description="该节点暂无调试记录"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div
      className={debugStyle["debug-info-tab"]}
      style={{
        padding: "12px 16px",
        maxHeight: "calc(85vh - 200px)",
        overflowY: "auto",
      }}
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
            title="执行次数"
            value={
              nodeExecutionHistory.filter((r) => r.status !== "running").length
            }
            suffix={`/ ${nodeExecutionHistory.length}`}
            styles={{ content: { fontSize: 20 } }}
          />
          {executionTime && (
            <Statistic
              title="执行时间"
              value={executionTime}
              styles={{ content: { fontSize: 20 } }}
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
