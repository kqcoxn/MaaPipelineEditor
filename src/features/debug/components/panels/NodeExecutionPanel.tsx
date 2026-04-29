import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Button,
  Checkbox,
  Empty,
  Input,
  Select,
  Space,
  Tag,
} from "antd";
import { AimOutlined, ClearOutlined, SearchOutlined } from "@ant-design/icons";
import { DebugSection } from "../DebugSection";
import type { DebugModalController } from "../../hooks/useDebugModalController";
import type { DebugNodeExecutionRecord } from "../../nodeExecutionSelector";
import { groupDebugNodeExecutionRecords } from "../../nodeExecutionSelector";
import {
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

  const handleSelectRecord = (record: DebugNodeExecutionRecord) => {
    selectNodeExecutionRecord(record);
  };

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
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <DebugSection title="节点执行筛选">
        <Space wrap>
          <Tag color={replayStatus?.active ? "purple" : "default"}>
            {replayStatus?.active ? `Replay #${replayStatus.cursorSeq}` : "Live"}
          </Tag>
          <Tag>运行 {summary.runId ?? "-"}</Tag>
          <Tag>记录 {visibleRecords.length}</Tag>
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

      {nodeExecutionRecords.length === 0 ? (
        <Empty description="没有符合筛选条件的节点执行记录" />
      ) : visibleRecords.length === 0 ? (
        <Empty description="没有符合搜索条件的节点执行记录" />
      ) : (
        <div style={layoutStyle}>
          <div style={listPaneStyle}>
            {nodeExecutionFilters.groupRepeated ? (
              <GroupedRecordList
                groups={groupedRecords}
                onSelectRecord={handleSelectRecord}
                selectedRecordId={selectedRecord?.id}
                totalRecordCount={visibleRecords.length}
              />
            ) : (
              <RecordList
                records={visibleRecords}
                onSelectRecord={handleSelectRecord}
                selectedRecordId={selectedRecord?.id}
              />
            )}
          </div>
          <div style={detailPaneStyle}>
            {selectedRecord && (
              <NodeExecutionRecordDetails
                artifacts={artifacts}
                record={selectedRecord}
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
