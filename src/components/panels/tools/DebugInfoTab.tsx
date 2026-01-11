import { memo, useMemo, useState } from "react";
import { Timeline, Tag, Empty, Collapse, Statistic, Button, List } from "antd";
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { useDebugStore } from "../../../stores/debugStore";
import { useFlowStore } from "../../../stores/flow";
import debugStyle from "../../../styles/DebugPanel.module.less";
import RecognitionDetailModal from "./RecognitionDetailModal";

/**
 * 调试信息标签页
 * 显示节点执行历史和识别记录
 */
function DebugInfoTab() {
  // Modal 状态
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // 获取状态
  const debugStatus = useDebugStore((state) => state.debugStatus);
  const sessionId = useDebugStore((state) => state.sessionId);
  const executionHistory = useDebugStore((state) => state.executionHistory);
  const executionStartTime = useDebugStore((state) => state.executionStartTime);
  const recognitionRecords = useDebugStore((state) => state.recognitionRecords);
  const setSelectedRecoId = useDebugStore((state) => state.setSelectedRecoId);

  // 获取当前选中的节点
  const selectedNode = useFlowStore((state) => state.targetNode);
  const selectedNodeId = selectedNode?.id || null;
  const selectedNodeName =
    selectedNode?.data?.label || selectedNode?.id || null;

  // 过滤出当前选中节点的执行历史
  const nodeExecutionHistory = useMemo(() => {
    if (!selectedNodeId) return [];
    return executionHistory.filter(
      (record) => record.nodeId === selectedNodeId
    );
  }, [executionHistory, selectedNodeId]);

  // 过滤出当前选中节点的识别记录（该节点自己被识别的记录）
  const nodeRecognitionRecords = useMemo(() => {
    if (!selectedNodeName) return [];
    // 过滤出该节点自己被识别的记录
    return recognitionRecords.filter(
      (record) =>
        record.name === selectedNodeName ||
        record.displayName === selectedNodeName
    );
  }, [recognitionRecords, selectedNodeName]);

  // 计算执行时间
  const executionTime = useMemo(() => {
    if (!executionStartTime) return null;
    const now = Date.now();
    const elapsed = Math.floor((now - executionStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [executionStartTime, debugStatus]);

  // 生成简化版时间轴项
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
                      {record.runIndex > 1 && (
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
                      {record.latency && (
                        <div style={{ fontSize: 12, color: "#666" }}>
                          耗时: {record.latency}ms
                        </div>
                      )}
                    </div>

                    {/* 错误信息 */}
                    {record.error && (
                      <div
                        style={{
                          padding: 8,
                          background: "#fff2f0",
                          borderRadius: 4,
                          fontSize: 12,
                          color: "#ff4d4f",
                        }}
                      >
                        错误: {record.error}
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
          {sessionId && (
            <span style={{ fontSize: 12, color: "#999" }}>
              Session ID: {sessionId.substring(0, 8)}...
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
      <div style={{ marginBottom: 24 }}>
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

      {/* 识别记录列表（该节点自己被识别的记录） */}
      {nodeRecognitionRecords.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 12,
              color: "#262626",
            }}
          >
            识别记录
          </div>
          <List
            size="small"
            bordered
            dataSource={nodeRecognitionRecords}
            renderItem={(record, index) => {
              const statusColor =
                record.status === "succeeded"
                  ? "success"
                  : record.status === "failed"
                  ? "error"
                  : "processing";
              const statusText =
                record.status === "succeeded"
                  ? "成功"
                  : record.status === "failed"
                  ? "失败"
                  : "识别中";

              return (
                <List.Item
                  style={{ padding: "8px 12px" }}
                  actions={[
                    record.recoId > 0 && (
                      <Button
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => {
                          setSelectedRecoId(record.recoId);
                          setDetailModalOpen(true);
                        }}
                      >
                        详情
                      </Button>
                    ),
                  ]}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{
                        color: "#999",
                        fontSize: 12,
                        minWidth: 24,
                      }}
                    >
                      [{nodeRecognitionRecords.length - index}]
                    </span>
                    <span style={{ fontWeight: 500 }}>{record.name}</span>
                    <Tag color={statusColor} style={{ margin: 0 }}>
                      {statusText}
                    </Tag>
                    {record.hit && (
                      <Tag color="blue" style={{ margin: 0 }}>
                        命中
                      </Tag>
                    )}
                  </div>
                </List.Item>
              );
            }}
          />
        </div>
      )}

      {/* 识别详情模态框 */}
      <RecognitionDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
      />
    </div>
  );
}

export default memo(DebugInfoTab);
