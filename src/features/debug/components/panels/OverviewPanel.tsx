import { Alert, Button, Space, Tag } from "antd";
import {
  CaretRightOutlined,
  FileSearchOutlined,
  PictureOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { DebugSection } from "../DebugSection";
import type { DebugModalController } from "../../hooks/useDebugModalController";

export function OverviewPanel({
  controller,
}: {
  controller: DebugModalController;
}) {
  const {
    capabilityStatus,
    capabilityError,
    lastError,
    debugReadiness,
    availableModeIds,
    selectedNodeId,
    session,
    activeRun,
    summary,
    lastRunMode,
    events,
    liveSummary,
    replayStatus,
    performanceSummary,
    startRun,
    confirmActionRun,
    stopRun,
  } = controller;

  return (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      {capabilityStatus === "error" && (
        <Alert
          type="error"
          showIcon
          message="调试能力读取失败"
          description={capabilityError}
        />
      )}
      {lastError && (
        <Alert
          type="error"
          showIcon
          message={lastError.code}
          description={lastError.message}
        />
      )}
      <DebugSection title="运行控制">
        <Space wrap>
          <Button
            type="primary"
            icon={<CaretRightOutlined />}
            onClick={() => startRun("full-run")}
            disabled={!debugReadiness.ready || !availableModeIds.has("full-run")}
          >
            完整运行
          </Button>
          <Button
            icon={<CaretRightOutlined />}
            onClick={() => startRun("run-from-node", selectedNodeId)}
            disabled={
              !debugReadiness.ready ||
              !selectedNodeId ||
              !availableModeIds.has("run-from-node")
            }
          >
            从选中节点运行
          </Button>
          <Button
            icon={<CaretRightOutlined />}
            onClick={() => startRun("single-node-run", selectedNodeId)}
            disabled={
              !debugReadiness.ready ||
              !selectedNodeId ||
              !availableModeIds.has("single-node-run")
            }
          >
            单节点运行
          </Button>
          <Button
            icon={<FileSearchOutlined />}
            onClick={() => startRun("recognition-only", selectedNodeId)}
            disabled={
              !debugReadiness.ready ||
              !selectedNodeId ||
              !availableModeIds.has("recognition-only")
            }
          >
            仅识别
          </Button>
          <Button
            danger
            icon={<CaretRightOutlined />}
            onClick={() => confirmActionRun(selectedNodeId)}
            disabled={
              !debugReadiness.ready ||
              !selectedNodeId ||
              !availableModeIds.has("action-only")
            }
          >
            仅动作
          </Button>
          <Button
            icon={<PictureOutlined />}
            onClick={() => startRun("fixed-image-recognition", selectedNodeId)}
            disabled={
              !debugReadiness.ready ||
              !selectedNodeId ||
              !availableModeIds.has("fixed-image-recognition")
            }
          >
            固定图识别
          </Button>
          <Button danger icon={<StopOutlined />} onClick={stopRun}>
            停止
          </Button>
        </Space>
      </DebugSection>
      <DebugSection title="会话与追踪（Session / Trace）">
        <Space wrap>
          <Tag color={session ? "green" : "default"}>
            {session?.sessionId ?? "未创建会话"}
          </Tag>
          <Tag>{session?.status ?? summary.status}</Tag>
          <Tag>运行 {activeRun?.runId ?? summary.runId ?? "-"}</Tag>
          <Tag>模式 {summary.runMode ?? lastRunMode}</Tag>
          <Tag>事件 {events.length}</Tag>
          <Tag>实时事件 {liveSummary.lastEvent?.seq ?? 0}</Tag>
          <Tag>当前节点 {summary.currentRuntimeName ?? "-"}</Tag>
          <Tag color={replayStatus?.active ? "purple" : "default"}>
            {replayStatus?.active
              ? `回放 #${replayStatus.cursorSeq}`
              : "实时"}
          </Tag>
          <Tag color="green">已访问 {summary.visitedNodeIds.length}</Tag>
          <Tag color="red">失败 {summary.failedNodeIds.length}</Tag>
        </Space>
      </DebugSection>
      {performanceSummary && (
        <DebugSection title="性能摘要（Performance）">
          <Space wrap>
            <Tag>耗时 {performanceSummary.durationMs ?? 0}ms</Tag>
            <Tag>节点 {performanceSummary.nodeCount}</Tag>
            <Tag>识别 {performanceSummary.recognitionCount}</Tag>
            <Tag>动作 {performanceSummary.actionCount}</Tag>
            <Tag>产物 {performanceSummary.artifactRefCount}</Tag>
          </Space>
        </DebugSection>
      )}
    </Space>
  );
}
