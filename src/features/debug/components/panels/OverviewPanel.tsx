import { useMemo, type CSSProperties } from "react";
import { Alert, Button, Select, Space, Tag, Typography } from "antd";
import {
  CaretRightOutlined,
  FileSearchOutlined,
  FlagOutlined,
  NodeIndexOutlined,
  PictureOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { DebugSection } from "../DebugSection";
import type { DebugModalController } from "../../hooks/useDebugModalController";
import { DEFAULT_DEBUG_NODE_EXECUTION_FILTERS } from "../../types";

const { Text } = Typography;

const runControlStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const nodePickerStyle: CSSProperties = {
  flex: "1 1 360px",
  minWidth: 320,
};

const runActionsStyle: CSSProperties = {
  flex: "0 1 520px",
};

interface NodeSelectOption {
  value: string;
  label: string;
  searchText: string;
}

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
    selectedPipelineNode,
    selectedPipelineNodeId,
    entryNode,
    pipelineNodes,
    profileState,
    session,
    activeRun,
    summary,
    lastRunMode,
    events,
    liveSummary,
    replayStatus,
    performanceSummary,
    allNodeExecutionRecords,
    startRun,
    confirmActionRun,
    stopRun,
    selectPipelineNode,
    setNodeExecutionFilters,
    openNodeExecutionRecord,
    setEntryFromSelectedNode,
  } = controller;
  const nodeOptions = useMemo(
    () =>
      pipelineNodes.map((node) => ({
        value: node.nodeId,
        label: node.displayName,
        searchText: [
          node.displayName,
          node.runtimeName,
          node.fileId,
          node.sourcePath,
        ]
          .filter(Boolean)
          .join(" "),
      })),
    [pipelineNodes],
  );
  const entryLabel =
    entryNode?.displayName ||
    profileState.profile.entry.runtimeName ||
    "未设置";
  const targetLabel = selectedPipelineNode?.displayName || "未选择";
  const hasSelectedNode = Boolean(selectedPipelineNodeId);
  const failedNodeExecutionRecords = useMemo(
    () => allNodeExecutionRecords.filter((record) => record.hasFailure),
    [allNodeExecutionRecords],
  );
  const latestFailedNodeExecutionRecord = useMemo(
    () =>
      [...failedNodeExecutionRecords].sort(
        (a, b) => b.lastSeq - a.lastSeq || b.firstSeq - a.firstSeq,
      )[0],
    [failedNodeExecutionRecords],
  );
  const openLatestFailedNode = () => {
    if (!latestFailedNodeExecutionRecord) return;
    setNodeExecutionFilters({
      ...DEFAULT_DEBUG_NODE_EXECUTION_FILTERS,
      status: "failed",
      failedOnly: true,
      sortMode: "failure-first",
    });
    openNodeExecutionRecord(latestFailedNodeExecutionRecord);
  };

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
        <div style={runControlStyle}>
          <Space direction="vertical" size={8} style={nodePickerStyle}>
            <Space wrap>
              <Tag color={entryNode ? "blue" : "default"}>
                入口 {entryLabel}
              </Tag>
              <Tag color={selectedPipelineNode ? "green" : "default"}>
                目标 {targetLabel}
              </Tag>
              <Tag>节点 {pipelineNodes.length}</Tag>
            </Space>
            <Select
              showSearch
              value={selectedPipelineNodeId}
              style={{ width: "100%" }}
              placeholder="搜索并选择 Pipeline 节点"
              filterOption={(input, option) =>
                String(
                  (option as NodeSelectOption | undefined)?.searchText ?? "",
                )
                  .toLowerCase()
                  .includes(input.trim().toLowerCase())
              }
              onChange={selectPipelineNode}
              options={nodeOptions}
              notFoundContent="当前图没有可调试 Pipeline 节点"
              optionRender={(option) => {
                const node = pipelineNodes.find(
                  (item) => item.nodeId === option.value,
                );
                if (!node) return option.label;
                return (
                  <Space direction="vertical" size={0}>
                    <Text>{node.displayName}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {node.fileId} · {node.runtimeName}
                    </Text>
                  </Space>
                );
              }}
            />
          </Space>
          <Space wrap style={runActionsStyle}>
            <Button
              icon={<FlagOutlined />}
              onClick={setEntryFromSelectedNode}
              disabled={!hasSelectedNode}
            >
              设为入口节点
            </Button>
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
              onClick={() => startRun("run-from-node", selectedPipelineNodeId)}
              disabled={
                !debugReadiness.ready ||
                !hasSelectedNode ||
                !availableModeIds.has("run-from-node")
              }
            >
              从此节点运行
            </Button>
            <Button
              icon={<CaretRightOutlined />}
              onClick={() => startRun("single-node-run", selectedPipelineNodeId)}
              disabled={
                !debugReadiness.ready ||
                !hasSelectedNode ||
                !availableModeIds.has("single-node-run")
              }
            >
              单节点运行
            </Button>
            <Button
              icon={<FileSearchOutlined />}
              onClick={() => startRun("recognition-only", selectedPipelineNodeId)}
              disabled={
                !debugReadiness.ready ||
                !hasSelectedNode ||
                !availableModeIds.has("recognition-only")
              }
            >
              仅识别
            </Button>
            <Button
              danger
              icon={<CaretRightOutlined />}
              onClick={() => confirmActionRun(selectedPipelineNodeId)}
              disabled={
                !debugReadiness.ready ||
                !hasSelectedNode ||
                !availableModeIds.has("action-only")
              }
            >
              仅动作
            </Button>
            <Button
              icon={<PictureOutlined />}
              onClick={() =>
                startRun("fixed-image-recognition", selectedPipelineNodeId)
              }
              disabled={
                !debugReadiness.ready ||
                !hasSelectedNode ||
                !availableModeIds.has("fixed-image-recognition")
              }
            >
              固定图识别
            </Button>
            <Button danger icon={<StopOutlined />} onClick={stopRun}>
              停止
            </Button>
          </Space>
        </div>
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
      {failedNodeExecutionRecords.length > 0 && latestFailedNodeExecutionRecord && (
        <DebugSection title="失败节点">
          <Space wrap>
            <Tag color="red">失败记录 {failedNodeExecutionRecords.length}</Tag>
            <Tag>{latestFailedNodeExecutionRecord.label ?? latestFailedNodeExecutionRecord.runtimeName}</Tag>
            <Tag>
              seq {latestFailedNodeExecutionRecord.firstSeq}-
              {latestFailedNodeExecutionRecord.lastSeq}
            </Tag>
            <Button
              danger
              size="small"
              icon={<NodeIndexOutlined />}
              onClick={openLatestFailedNode}
            >
              查看失败节点
            </Button>
          </Space>
        </DebugSection>
      )}
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
