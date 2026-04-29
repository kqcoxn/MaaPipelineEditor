import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Button,
  Checkbox,
  Empty,
  Input,
  Segmented,
  Select,
  Space,
  Tag,
} from "antd";
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
  ComparisonList,
  GroupedRecordList,
  RecordList,
} from "./NodeExecutionRecordList";
import { debugNodeExecutionEventKindLabels } from "../../nodeExecutionDisplay";
import type {
  DebugEventKind,
  DebugNodeExecutionArtifactFilter,
  DebugNodeExecutionEventKindFilter,
  DebugNodeExecutionStatusFilter,
  DebugNodeExecutionSortMode,
} from "../../types";
import { DEFAULT_DEBUG_NODE_EXECUTION_FILTERS } from "../../types";
import { NodeExecutionRecordDetails } from "./NodeExecutionRecordDetails";

const layoutStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const listPaneStyle: CSSProperties = {
  flex: "1 1 360px",
  minWidth: 320,
};

const detailPaneStyle: CSSProperties = {
  flex: "1.4 1 440px",
  minWidth: 360,
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

export function NodeExecutionPanel({
  controller,
}: {
  controller: DebugModalController;
}) {
  const {
    allNodeExecutionRecords,
    artifacts,
    events,
    nodeExecutionFilters,
    nodeExecutionRecords,
    pipelineNodes,
    replayStatus,
    requestArtifact,
    resolverEdgeIndex,
    selectedArtifact,
    selectedFlowNodeId,
    selectedNodeExecutionRecordId,
    selectNodeExecutionRecord,
    setSelectedNodeExecutionRecordId,
    setNodeExecutionFilters,
    summary,
  } = controller;
  const {
    batchRecognitionNodeSummaries,
    nodeExecutionRunComparisons,
    nodeReplayControl,
    seekNodeTraceReplay,
    startNodeTraceReplay,
    stopTraceReplay,
  } = controller;
  const [searchText, setSearchText] = useState("");
  const [viewMode, setViewMode] = useState<"sequence" | "compare">("sequence");
  const [comparisonRunIdsDraft, setComparisonRunIdsDraft] = useState<
    [string, string]
  >(() => nodeExecutionFilters.comparisonRunIds ?? ["", ""]);
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
  const selectedRecordSource =
    viewMode === "compare" ? allNodeExecutionRecords : visibleRecords;
  const selectedRecord =
    selectedRecordSource.find(
      (record) => record.id === selectedNodeExecutionRecordId,
    ) ?? (viewMode === "compare" ? undefined : visibleRecords[0]);

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

  const nodeOptions = useMemo(
    () => {
      const runtimeOnlyOptions = uniqueRuntimeOnlyOptions(
        allNodeExecutionRecords,
      );
      return [
        { value: "", label: "全部节点" },
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
          label: runId,
        }),
      ),
    ],
    [allNodeExecutionRecords],
  );
  const comparisonRunIds = comparisonRunIdsDraft;
  const comparisonReady =
    viewMode === "compare" &&
    comparisonRunIds[0] !== "" &&
    comparisonRunIds[1] !== "" &&
    comparisonRunIds[0] !== comparisonRunIds[1];

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
    setComparisonRunIdsDraft(["", ""]);
    setNodeExecutionFilters(DEFAULT_DEBUG_NODE_EXECUTION_FILTERS);
  };
  const updateComparisonRun = (index: 0 | 1, runId?: string) => {
    const current = comparisonRunIdsDraft;
    const next: [string, string] = [...current] as [string, string];
    next[index] = runId ?? "";
    setComparisonRunIdsDraft(next);
    setNodeExecutionFilters({
      ...nodeExecutionFilters,
      comparisonRunIds:
        next[0] && next[1] && next[0] !== next[1] ? next : undefined,
    });
  };

  if (events.length === 0) {
    return <Empty description="暂无节点执行记录" />;
  }

  if (rawNodeExecutionCount === 0) {
    return <Empty description="当前 trace 尚未出现可映射节点事件" />;
  }

  return (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <DebugSection title="节点执行筛选">
        <Space wrap>
          <Tag color={replayStatus?.active ? "purple" : "default"}>
            {replayStatus?.active ? `Replay #${replayStatus.cursorSeq}` : "Live"}
          </Tag>
          <Tag>运行 {summary.runId ?? "-"}</Tag>
          <Tag>记录 {visibleRecords.length}</Tag>
          <Segmented
            size="small"
            value={viewMode}
            options={[
              { label: "执行序列", value: "sequence" },
              { label: "Run 对比", value: "compare" },
            ]}
            onChange={(value) => setViewMode(value as "sequence" | "compare")}
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
            checked={nodeExecutionFilters.failedOnly === true}
            onChange={(event) =>
              setNodeExecutionFilters({
                ...nodeExecutionFilters,
                failedOnly: event.target.checked,
              })
            }
          >
            只看失败
          </Checkbox>
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

      <DebugSection title="节点级回放">
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

      {viewMode === "compare" && (
        <DebugSection title="Run 对比">
          <Space wrap>
            <Select
              size="small"
              style={{ minWidth: 180 }}
              placeholder="选择左侧 run"
              value={comparisonRunIds[0] || undefined}
              options={runOptions.filter((option) => option.value)}
              onChange={(runId) => updateComparisonRun(0, runId)}
            />
            <Select
              size="small"
              style={{ minWidth: 180 }}
              placeholder="选择右侧 run"
              value={comparisonRunIds[1] || undefined}
              options={runOptions.filter((option) => option.value)}
              onChange={(runId) => updateComparisonRun(1, runId)}
            />
            <Tag>
              差异{" "}
              {nodeExecutionRunComparisons.filter((item) => item.hasDifference).length}
            </Tag>
          </Space>
        </DebugSection>
      )}

      {viewMode !== "compare" && nodeExecutionRecords.length === 0 ? (
        <Empty description="没有符合筛选条件的节点执行记录" />
      ) : viewMode === "compare" && !comparisonReady ? (
        <Empty description="请选择两个不同的 run 进行对比" />
      ) : viewMode !== "compare" && visibleRecords.length === 0 ? (
        <Empty description="没有符合搜索条件的节点执行记录" />
      ) : (
        <div style={layoutStyle}>
          <div style={listPaneStyle}>
            {viewMode === "compare" ? (
              <ComparisonList
                comparisons={nodeExecutionRunComparisons}
                onSelectRecord={handleSelectRecord}
                replayRecordState={replayRecordState}
              />
            ) : nodeExecutionFilters.groupRepeated ? (
              <GroupedRecordList
                groups={groupedRecords}
                onSelectRecord={handleSelectRecord}
                replayRecordState={replayRecordState}
                selectedRecordId={selectedRecord?.id}
                totalRecordCount={visibleRecords.length}
              />
            ) : (
              <RecordList
                records={visibleRecords}
                onSelectRecord={handleSelectRecord}
                replayRecordState={replayRecordState}
                selectedRecordId={selectedRecord?.id}
              />
            )}
          </div>
          <div style={detailPaneStyle}>
            {selectedRecord && (
              <NodeExecutionRecordDetails
                artifacts={artifacts}
                batchSummaries={batchRecognitionNodeSummaries}
                record={selectedRecord}
                replayControl={nodeReplayControl}
                requestArtifact={requestArtifact}
                resolverEdgeIndex={resolverEdgeIndex}
                selectedArtifact={selectedArtifact}
              />
            )}
          </div>
        </div>
      )}
    </Space>
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
