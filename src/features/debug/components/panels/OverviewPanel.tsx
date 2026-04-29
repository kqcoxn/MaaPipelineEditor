import { useMemo, type CSSProperties, type ReactNode } from "react";
import { Alert, Button, Select, Space, Typography } from "antd";
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
import {
  findDebugRunFirstTimestamp,
  formatDebugRunDisplayName,
} from "../../runDisplayName";

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

const metaListStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  columnGap: 16,
  rowGap: 6,
  width: "100%",
};

const metaItemStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 4,
  minWidth: 0,
  overflowWrap: "anywhere",
};

const metaItemWideStyle: CSSProperties = {
  ...metaItemStyle,
  flex: "1 1 240px",
};

const metaValueStyle: CSSProperties = {
  minWidth: 0,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
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
      sortMode: "failure-first",
    });
    openNodeExecutionRecord(latestFailedNodeExecutionRecord);
  };
  const currentRunId = activeRun?.runId ?? summary.runId;
  const currentRunLabel = formatDebugRunDisplayName(
    currentRunId,
    activeRun?.startedAt ?? findDebugRunFirstTimestamp(currentRunId, events),
  );

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
            <div style={metaListStyle}>
              <MetaItem label="入口" value={entryLabel} wide />
              <MetaItem label="目标" value={targetLabel} wide />
              <MetaItem label="节点" value={pipelineNodes.length} />
            </div>
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
        <div style={metaListStyle}>
          <MetaItem label="会话" value={session?.sessionId ?? "未创建会话"} wide />
          <MetaItem label="状态" value={session?.status ?? summary.status} />
          <MetaItem label="运行" value={currentRunLabel} />
          <MetaItem label="模式" value={summary.runMode ?? lastRunMode} />
          <MetaItem label="事件" value={events.length} />
          <MetaItem label="实时事件" value={liveSummary.lastEvent?.seq ?? 0} />
          <MetaItem label="当前节点" value={summary.currentRuntimeName ?? "-"} wide />
          <MetaItem
            label="追踪"
            value={replayStatus?.active ? `回放 #${replayStatus.cursorSeq}` : "实时"}
          />
          <MetaItem label="已访问" value={summary.visitedNodeIds.length} />
          <MetaItem label="失败" value={summary.failedNodeIds.length} />
        </div>
      </DebugSection>
      {failedNodeExecutionRecords.length > 0 && latestFailedNodeExecutionRecord && (
        <DebugSection title="失败节点">
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <div style={metaListStyle}>
              <MetaItem label="失败记录" value={failedNodeExecutionRecords.length} />
              <MetaItem
                label="节点"
                value={
                  latestFailedNodeExecutionRecord.label ??
                  latestFailedNodeExecutionRecord.runtimeName
                }
                wide
              />
              <MetaItem
                label="seq"
                value={`${latestFailedNodeExecutionRecord.firstSeq}-${latestFailedNodeExecutionRecord.lastSeq}`}
              />
            </div>
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
          <div style={metaListStyle}>
            <MetaItem label="耗时" value={`${performanceSummary.durationMs ?? 0}ms`} />
            <MetaItem label="节点" value={performanceSummary.nodeCount} />
            <MetaItem label="识别" value={performanceSummary.recognitionCount} />
            <MetaItem label="动作" value={performanceSummary.actionCount} />
            <MetaItem label="产物" value={performanceSummary.artifactRefCount} />
          </div>
        </DebugSection>
      )}
    </Space>
  );
}

function MetaItem({
  label,
  value,
  wide,
}: {
  label: string;
  value: ReactNode;
  wide?: boolean;
}) {
  return (
    <span style={wide ? metaItemWideStyle : metaItemStyle}>
      <Text type="secondary">{label}</Text>
      <Text style={metaValueStyle}>{value}</Text>
    </span>
  );
}
