import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Button, Checkbox, Empty, Input, Segmented, Select, Space, Tag, Typography } from "antd";
import {
  AimOutlined,
  ClearOutlined,
  SearchOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
} from "@ant-design/icons";
import { DebugSection } from "../DebugSection";
import type { DebugModalController } from "../../hooks/useDebugModalController";
import {
  getDebugReplayRecordState,
  type DebugNodeReplayRecordState,
} from "../../nodeExecutionAnalysis";
import type { DebugNodeExecutionRecord } from "../../nodeExecutionSelector";
import { groupDebugNodeExecutionRecords } from "../../nodeExecutionSelector";
import {
  resolveAutoLoadAttemptArtifact,
} from "../../nodeExecutionAttempts";
import {
  GroupedRecordList,
  RecordList,
} from "./NodeExecutionRecordList";
import { debugNodeExecutionEventKindLabels } from "../../nodeExecutionDisplay";
import type {
  DebugExecutionAttributionMode,
  DebugExecutionDetailMode,
  DebugEventKind,
  DebugNodeExecutionArtifactFilter,
  DebugNodeExecutionEventKindFilter,
  DebugNodeExecutionStatusFilter,
  DebugNodeExecutionSortMode,
} from "../../types";
import { DEFAULT_DEBUG_NODE_EXECUTION_FILTERS } from "../../types";
import { NodeExecutionRecordDetails } from "./NodeExecutionRecordDetails";
import {
  findDebugRunFirstTimestamp,
  formatDebugRunDisplayName,
} from "../../runDisplayName";
import { formatDebugNodeDisplayName } from "../../syntheticNode";

const workspaceStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))",
  alignItems: "stretch",
  gap: 12,
  flex: "1 1 0",
  minHeight: 0,
  overflow: "hidden",
};

const panelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  height: "100%",
  minHeight: 0,
  width: "100%",
};

const scrollPaneStyle: CSSProperties = {
  minWidth: 0,
  minHeight: 0,
  height: "100%",
  overflowY: "auto",
  overflowX: "hidden",
  paddingRight: 4,
  scrollbarGutter: "stable",
};

const statusOptions: Array<{
  value: DebugNodeExecutionStatusFilter;
  label: string;
}> = [
  { value: "all", label: "全部状态" },
  { value: "running", label: "运行中" },
  { value: "succeeded", label: "成功" },
  { value: "failed", label: "失败" },
  { value: "visited", label: "已访问" },
];

const eventKindOptions: Array<{
  value: DebugNodeExecutionEventKindFilter;
  label: string;
}> = [
  { value: "all", label: "全部事件" },
  ...(
    [
      "node",
      "recognition",
      "action",
      "next-list",
      "wait-freezes",
      "diagnostic",
      "screenshot",
      "artifact",
      "task",
      "session",
      "log",
    ] satisfies DebugEventKind[]
  ).map((kind) => ({
    value: kind,
    label: debugNodeExecutionEventKindLabels[kind],
  })),
];

const artifactOptions: Array<{
  value: DebugNodeExecutionArtifactFilter;
  label: string;
}> = [
  { value: "all", label: "全部产物" },
  { value: "with-artifact", label: "含产物" },
  { value: "without-artifact", label: "无产物" },
];

const sortOptions: Array<{
  value: DebugNodeExecutionSortMode;
  label: string;
}> = [
  { value: "execution", label: "执行顺序" },
  { value: "failure-first", label: "失败优先" },
  { value: "slow-first", label: "慢节点优先" },
  { value: "latest", label: "最新优先" },
];

const attributionModeOptions: Array<{
  value: DebugExecutionAttributionMode;
  label: string;
}> = [
  { value: "next", label: "Next 模式" },
  { value: "node", label: "节点模式" },
];

const detailModeOptions: Array<{
  value: DebugExecutionDetailMode;
  label: string;
}> = [
  { value: "compact", label: "精简" },
  { value: "detailed", label: "详细" },
];

export function NodeExecutionPanel({
  controller,
}: {
  controller: DebugModalController;
}) {
  const {
    allNodeExecutionRecords,
    artifacts,
    events,
    nodeExecutionAttributionMode,
    nodeExecutionDetailMode,
    nodeExecutionFilters,
    nodeExecutionRecords,
    pipelineNodes,
    replayStatus,
    requestArtifact,
    resolverEdgeIndex,
    selectedArtifact,
    selectedNodeExecutionAttempt,
    selectedNodeExecutionAttemptId,
    selectedFlowNodeId,
    selectedNodeExecutionRecordId,
    selectNodeExecutionRecord,
    setSelectedNodeExecutionAttemptId,
    setSelectedNodeExecutionRecordId,
    setNodeExecutionAttributionMode,
    setNodeExecutionDetailMode,
    setNodeExecutionFilters,
    summary,
  } = controller;
  const {
    batchRecognitionNodeSummaries,
    nodeReplayControl,
    seekNodeTraceReplay,
    startNodeTraceReplay,
    stopTraceReplay,
  } = controller;
  const [searchText, setSearchText] = useState("");
  const rawNodeExecutionCount = useMemo(
    () => Object.values(summary.nodeReplays).flat().length,
    [summary.nodeReplays],
  );
  const visibleRecords = useMemo(
    () => filterRecordsBySearch(nodeExecutionRecords, searchText),
    [nodeExecutionRecords, searchText],
  );
  const groupedRecords = useMemo(
    () => groupDebugNodeExecutionRecords(visibleRecords),
    [visibleRecords],
  );
  const selectedFlowNode = pipelineNodes.find(
    (node) => node.nodeId === selectedFlowNodeId,
  );
  const selectedRecord =
    visibleRecords.find(
      (record) => record.id === selectedNodeExecutionRecordId,
    ) ?? visibleRecords[0];

  useEffect(() => {
    if (!selectedRecord) {
      if (selectedNodeExecutionRecordId) {
        setSelectedNodeExecutionRecordId(undefined);
      }
      return;
    }
    if (selectedRecord.id !== selectedNodeExecutionRecordId) {
      setSelectedNodeExecutionRecordId(selectedRecord.id);
    }
  }, [
    selectedNodeExecutionRecordId,
    selectedRecord,
    setSelectedNodeExecutionRecordId,
  ]);

  useEffect(() => {
    const artifactId = resolveAutoLoadAttemptArtifact(
      artifacts,
      selectedNodeExecutionAttempt,
      selectedArtifact?.ref.id,
    );
    if (artifactId) requestArtifact(artifactId);
  }, [
    artifacts,
    requestArtifact,
    selectedArtifact?.ref.id,
    selectedNodeExecutionAttempt,
  ]);

  const nodeOptions = useMemo(
    () => {
      const runtimeOnlyOptions = uniqueRuntimeOnlyOptions(
        allNodeExecutionRecords,
      );
      const systemRecordOptions = uniqueSystemRecordOptions(
        allNodeExecutionRecords,
      );
      return [
        { value: "", label: "全部节点" },
        ...systemRecordOptions,
        ...pipelineNodes.map((node) => ({
          value: node.nodeId,
          label: `${node.displayName} · ${node.runtimeName}`,
        })),
        ...runtimeOnlyOptions,
      ];
    },
    [allNodeExecutionRecords, pipelineNodes],
  );
  const runOptions = useMemo(
    () => [
      { value: "", label: "全部运行" },
      ...uniqueStrings(allNodeExecutionRecords.map((record) => record.runId)).map(
        (runId) => ({
          value: runId,
          label: formatDebugRunDisplayName(
            runId,
            findDebugRunFirstTimestamp(runId, events),
          ),
        }),
      ),
    ],
    [allNodeExecutionRecords, events],
  );

  const handleSelectRecord = (record: DebugNodeExecutionRecord) => {
    selectNodeExecutionRecord(record);
    if (replayStatus?.active) {
      seekNodeTraceReplay(record, record.firstSeq);
    }
  };
  const replayRecordState = (record: DebugNodeExecutionRecord) =>
    getDebugReplayRecordState(record, replayStatus);

  const setSelectedFlowFilter = () => {
    if (!selectedFlowNode) return;
    setNodeExecutionFilters({
      ...nodeExecutionFilters,
      nodeId: selectedFlowNode.nodeId,
    });
  };

  const clearFilters = () => {
    setSearchText("");
    setNodeExecutionFilters(DEFAULT_DEBUG_NODE_EXECUTION_FILTERS);
  };

  if (events.length === 0) {
    return <Empty description="暂无节点执行记录" />;
  }

  if (rawNodeExecutionCount === 0) {
    return <Empty description="当前 trace 尚未出现可映射节点事件" />;
  }

  return (
    <div style={panelStyle}>
      <DebugSection title="节点执行筛选" collapsible defaultCollapsed>
        <Space wrap>
          <Tag color={replayStatus?.active ? "purple" : "default"}>
            {replayStatus?.active ? `Replay #${replayStatus.cursorSeq}` : "Live"}
          </Tag>
          <Tag>
            运行{" "}
            {formatDebugRunDisplayName(
              summary.runId,
              findDebugRunFirstTimestamp(summary.runId, events),
            )}
          </Tag>
          <Tag>记录 {visibleRecords.length}</Tag>
          <Segmented
            size="small"
            value={nodeExecutionAttributionMode}
            options={attributionModeOptions}
            onChange={(mode) =>
              setNodeExecutionAttributionMode(
                mode as DebugExecutionAttributionMode,
              )
            }
          />
          <Typography.Text type="secondary">
            {nodeExecutionAttributionMode === "next"
              ? "Next 看跳转判断"
              : "节点看识别 / 动作"}
          </Typography.Text>
          <Segmented
            size="small"
            value={nodeExecutionDetailMode}
            options={detailModeOptions}
            onChange={(mode) =>
              setNodeExecutionDetailMode(mode as DebugExecutionDetailMode)
            }
          />
          <Select
            size="small"
            style={{ minWidth: 160 }}
            value={nodeExecutionFilters.runId ?? ""}
            options={runOptions}
            showSearch
            optionFilterProp="label"
            onChange={(runId) =>
              setNodeExecutionFilters({
                ...nodeExecutionFilters,
                runId: runId || undefined,
              })
            }
          />
          <Input
            size="small"
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索节点 / runtime / seq"
            style={{ width: 220 }}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <Select
            size="small"
            style={{ minWidth: 220 }}
            value={nodeExecutionFilters.nodeId ?? ""}
            options={nodeOptions}
            showSearch
            optionFilterProp="label"
            onChange={(nodeId) =>
              setNodeExecutionFilters({
                ...nodeExecutionFilters,
                nodeId: nodeId || undefined,
              })
            }
          />
          <Select
            size="small"
            style={{ width: 132 }}
            value={nodeExecutionFilters.status}
            options={statusOptions}
            onChange={(status) =>
              setNodeExecutionFilters({
                ...nodeExecutionFilters,
                status,
              })
            }
          />
          <Select
            size="small"
            style={{ width: 132 }}
            value={nodeExecutionFilters.eventKind ?? "all"}
            options={eventKindOptions}
            onChange={(eventKind) =>
              setNodeExecutionFilters({
                ...nodeExecutionFilters,
                eventKind,
              })
            }
          />
          <Select
            size="small"
            style={{ width: 120 }}
            value={nodeExecutionFilters.artifact ?? "all"}
            options={artifactOptions}
            onChange={(artifact) =>
              setNodeExecutionFilters({
                ...nodeExecutionFilters,
                artifact,
              })
            }
          />
          <Select
            size="small"
            style={{ width: 132 }}
            value={nodeExecutionFilters.sortMode ?? "execution"}
            options={sortOptions}
            onChange={(sortMode) =>
              setNodeExecutionFilters({
                ...nodeExecutionFilters,
                sortMode,
              })
            }
          />
          <Checkbox
            checked={nodeExecutionFilters.groupRepeated === true}
            onChange={(event) =>
              setNodeExecutionFilters({
                ...nodeExecutionFilters,
                groupRepeated: event.target.checked,
              })
            }
          >
            按节点折叠
          </Checkbox>
          <Button
            size="small"
            icon={<AimOutlined />}
            disabled={!selectedFlowNode}
            onClick={setSelectedFlowFilter}
          >
            只看选中节点
          </Button>
          <Button size="small" icon={<ClearOutlined />} onClick={clearFilters}>
            清空筛选
          </Button>
        </Space>
      </DebugSection>

      <DebugSection title="节点级回放" collapsible defaultCollapsed>
        <Space wrap>
          <Tag color={nodeReplayControl.active ? "purple" : "default"}>
            {nodeReplayControl.active
              ? `Replay #${nodeReplayControl.cursorSeq}`
              : "Live"}
          </Tag>
          <Tag>{replayStateLabel(nodeReplayControl.recordState)}</Tag>
          <Button
            size="small"
            type="primary"
            onClick={() => selectedRecord && startNodeTraceReplay(selectedRecord)}
            disabled={!selectedRecord}
          >
            回放当前记录
          </Button>
          <Button
            size="small"
            icon={<StepBackwardOutlined />}
            onClick={() =>
              selectedRecord &&
              seekNodeTraceReplay(selectedRecord, selectedRecord.firstSeq)
            }
            disabled={!selectedRecord}
          >
            到记录开始
          </Button>
          <Button
            size="small"
            icon={<StepForwardOutlined />}
            onClick={() =>
              selectedRecord &&
              seekNodeTraceReplay(selectedRecord, selectedRecord.lastSeq)
            }
            disabled={!selectedRecord}
          >
            到记录结束
          </Button>
          <Button size="small" danger onClick={stopTraceReplay}>
            回到实时
          </Button>
          {selectedRecord && (
            <Tag>
              当前记录 seq {selectedRecord.firstSeq}-{selectedRecord.lastSeq}
            </Tag>
          )}
        </Space>
      </DebugSection>

      {nodeExecutionRecords.length === 0 ? (
        <Empty description="没有符合筛选条件的节点执行记录" />
      ) : visibleRecords.length === 0 ? (
        <Empty description="没有符合搜索条件的节点执行记录" />
      ) : (
        <div style={workspaceStyle}>
          <div style={scrollPaneStyle}>
            {nodeExecutionFilters.groupRepeated ? (
              <GroupedRecordList
                events={events}
                groups={groupedRecords}
                detailMode={nodeExecutionDetailMode}
                onSelectRecord={handleSelectRecord}
                replayRecordState={replayRecordState}
                selectedRecordId={selectedRecord?.id}
                totalRecordCount={visibleRecords.length}
              />
            ) : (
              <RecordList
                events={events}
                records={visibleRecords}
                detailMode={nodeExecutionDetailMode}
                onSelectRecord={handleSelectRecord}
                replayRecordState={replayRecordState}
                selectedRecordId={selectedRecord?.id}
              />
            )}
          </div>
          <div style={scrollPaneStyle}>
            {selectedRecord && (
              <NodeExecutionRecordDetails
                artifacts={artifacts}
                batchSummaries={batchRecognitionNodeSummaries}
                detailMode={nodeExecutionDetailMode}
                events={events}
                onSelectAttempt={setSelectedNodeExecutionAttemptId}
                record={selectedRecord}
                replayControl={nodeReplayControl}
                requestArtifact={requestArtifact}
                resolverEdgeIndex={resolverEdgeIndex}
                selectedArtifact={selectedArtifact}
                selectedAttemptId={selectedNodeExecutionAttemptId}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function filterRecordsBySearch(
  records: DebugNodeExecutionRecord[],
  searchText: string,
): DebugNodeExecutionRecord[] {
  const keyword = searchText.trim().toLowerCase();
  if (!keyword) return records;
  return records.filter((record) =>
    [
      record.label,
      record.runtimeName,
      record.fileId,
      record.nodeId,
      record.sourcePath,
      record.runId,
      record.status,
      `seq ${record.firstSeq}-${record.lastSeq}`,
      ...record.eventKinds,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword)),
  );
}

function uniqueRuntimeOnlyOptions(records: DebugNodeExecutionRecord[]) {
  return uniqueStrings(
    records
      .filter((record) => record.unmapped)
      .map((record) => record.runtimeName),
  ).map((runtimeName) => ({
    value: runtimeName,
    label: `${runtimeName} · runtimeName-only`,
  }));
}

function uniqueSystemRecordOptions(records: DebugNodeExecutionRecord[]) {
  const options = new Map<string, string>();
  for (const record of records) {
    if (!record.syntheticKind) continue;
    options.set(
      record.runtimeName,
      `${formatDebugNodeDisplayName(record, record.runtimeName)} · 系统记录`,
    );
  }
  return [...options.entries()].map(([value, label]) => ({ value, label }));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ""))];
}

function replayStateLabel(state: DebugNodeReplayRecordState): string {
  switch (state) {
    case "current":
      return "光标位于当前记录";
    case "passed":
      return "当前记录已回放";
    case "not-reached":
      return "当前记录未到达";
    case "live":
    default:
      return "实时追踪";
  }
}
