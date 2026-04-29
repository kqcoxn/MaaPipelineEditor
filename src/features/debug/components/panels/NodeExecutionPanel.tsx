import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Input,
  List,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { AimOutlined, ClearOutlined, SearchOutlined } from "@ant-design/icons";
import { DebugSection } from "../DebugSection";
import type { DebugModalController } from "../../hooks/useDebugModalController";
import type { DebugNodeExecutionRecord } from "../../nodeExecutionSelector";
import {
  findDebugResolverEdge,
  groupDebugNodeExecutionRecords,
} from "../../nodeExecutionSelector";
import {
  GroupedRecordList,
  RecordList,
  StatusTag,
} from "./NodeExecutionRecordList";
import {
  debugNodeExecutionEventKindLabels,
  formatDebugNodeExecutionDuration,
} from "../../nodeExecutionDisplay";
import type {
  DebugEvent,
  DebugEventKind,
  DebugNodeExecutionArtifactFilter,
  DebugNodeExecutionEventKindFilter,
  DebugNodeExecutionStatusFilter,
  DebugNodeExecutionSortMode,
} from "../../types";
import { DEFAULT_DEBUG_NODE_EXECUTION_FILTERS } from "../../types";
import { eventTitle, formatTime } from "../../modalUtils";

const { Text } = Typography;

type ArtifactEntries = DebugModalController["artifacts"];

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

const preStyle: CSSProperties = {
  whiteSpace: "pre-wrap",
  margin: 0,
  maxHeight: 280,
  overflow: "auto",
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
              <RecordDetails
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

function RecordDetails({
  artifacts,
  record,
  requestArtifact,
  resolverEdgeIndex,
  selectedArtifact,
}: {
  artifacts: ArtifactEntries;
  record: DebugNodeExecutionRecord;
  requestArtifact: DebugModalController["requestArtifact"];
  resolverEdgeIndex: DebugModalController["resolverEdgeIndex"];
  selectedArtifact: DebugModalController["selectedArtifact"];
}) {
  const selectedArtifactIsRelated =
    selectedArtifact &&
    (record.detailRefs.includes(selectedArtifact.ref.id) ||
      record.screenshotRefs.includes(selectedArtifact.ref.id));

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <DebugSection title="执行概览">
        <Space wrap>
          <StatusTag status={record.status} />
          <Tag>run {record.runId}</Tag>
          <Tag>occurrence {record.occurrence}</Tag>
          <Tag>
            seq {record.firstSeq}-{record.lastSeq}
          </Tag>
          {record.durationMs !== undefined && (
            <Tag>
              耗时 {formatDebugNodeExecutionDuration(record.durationMs)}
              {record.durationSource === "performance" ? " · performance" : ""}
            </Tag>
          )}
          <Tag>runtime {record.runtimeName}</Tag>
          {record.hasFailure && <Tag color="red">含失败</Tag>}
          {record.slow && <Tag color="volcano">慢节点</Tag>}
          {record.hasArtifact && <Tag color="purple">含产物</Tag>}
          {record.sourcePath && <Tag>{record.sourcePath}</Tag>}
        </Space>
      </DebugSection>

      {record.unmapped && (
        <Alert
          type="warning"
          showIcon
          message="该记录未映射到 MPE 图节点"
          description="面板保留 runtimeName 事件；画布定位需要 fileId/nodeId 映射。"
        />
      )}

      <EventGroup
        artifacts={artifacts}
        events={record.recognitionEvents}
        kind="recognition"
        title="识别事件"
      />
      <EventGroup
        artifacts={artifacts}
        events={record.actionEvents}
        kind="action"
        title="动作事件"
      />
      <NextListGroup
        events={record.nextListEvents}
        fromRuntimeName={record.runtimeName}
        resolverEdgeIndex={resolverEdgeIndex}
      />
      <SimpleEventGroup events={record.waitFreezesEvents} title="WaitFreezes" />
      <SimpleEventGroup
        events={record.events.filter((event) => event.kind === "diagnostic")}
        title="诊断事件"
      />

      <DebugSection title="Artifact">
        {record.detailRefs.length === 0 && record.screenshotRefs.length === 0 ? (
          <Text type="secondary">该执行记录没有 artifact 引用。</Text>
        ) : (
          <Space wrap>
            {record.detailRefs.map((ref) => (
              <Button key={ref} size="small" onClick={() => requestArtifact(ref)}>
                查看详情 #{shortRef(ref)}
              </Button>
            ))}
            {record.screenshotRefs.map((ref) => (
              <Button key={ref} size="small" onClick={() => requestArtifact(ref)}>
                查看图像 #{shortRef(ref)}
              </Button>
            ))}
          </Space>
        )}
      </DebugSection>

      {selectedArtifactIsRelated && (
        <DebugSection title="已选 Artifact 预览">
          {selectedArtifact.error && (
            <Alert type="error" showIcon message={selectedArtifact.error} />
          )}
          {selectedArtifact.payload?.content &&
            selectedArtifact.payload.ref.mime.startsWith("image/") && (
              <img
                alt={selectedArtifact.payload.ref.type}
                src={`data:${selectedArtifact.payload.ref.mime};base64,${selectedArtifact.payload.content}`}
                style={{ maxWidth: "100%", maxHeight: 360 }}
              />
            )}
          {selectedArtifact.payload?.data !== undefined && (
            <pre style={preStyle}>
              {JSON.stringify(selectedArtifact.payload.data, null, 2)}
            </pre>
          )}
          {selectedArtifact.payload?.content &&
            !selectedArtifact.payload.ref.mime.startsWith("image/") && (
              <pre style={preStyle}>{selectedArtifact.payload.content}</pre>
            )}
        </DebugSection>
      )}

      <SimpleEventGroup
        events={record.events.filter((event) => event.maafwMessage)}
        title="MaaFW 原始消息"
      />
    </Space>
  );
}

function EventGroup({
  artifacts,
  events,
  kind,
  title,
}: {
  artifacts: ArtifactEntries;
  events: DebugEvent[];
  kind: "recognition" | "action";
  title: string;
}) {
  if (events.length === 0) return null;

  return (
    <DebugSection title={title}>
      <List
        size="small"
        dataSource={events}
        renderItem={(event) => (
          <List.Item>
            <Space direction="vertical" size={4} style={{ width: "100%" }}>
              <Space wrap size={4}>
                <Tag>#{event.seq}</Tag>
                <Tag>{event.phase ?? "-"}</Tag>
                {event.maafwMessage && <Tag>{event.maafwMessage}</Tag>}
                {event.detailRef && <Tag color="purple">详情</Tag>}
                {event.screenshotRef && <Tag color="cyan">图像</Tag>}
              </Space>
              <SummaryLine
                data={readEventDetail(artifacts, event)}
                event={event}
                kind={kind}
              />
            </Space>
          </List.Item>
        )}
      />
    </DebugSection>
  );
}

function SummaryLine({
  data,
  event,
  kind,
}: {
  data?: Record<string, unknown>;
  event: DebugEvent;
  kind: "recognition" | "action";
}) {
  const fields: Array<[string, unknown]> =
    kind === "recognition"
      ? [
          ["hit", data?.hit ?? event.data?.hit],
          ["algorithm", data?.algorithm ?? event.data?.algorithm],
          ["box", data?.box ?? event.data?.box],
        ]
      : [
          ["action", data?.action ?? event.data?.action],
          ["success", data?.success ?? event.data?.success],
          ["box", data?.box ?? event.data?.box],
        ];

  return (
    <Space wrap size={4}>
      {fields.map(([label, value]) => (
        <Tag key={label}>{`${label}: ${formatValue(value)}`}</Tag>
      ))}
    </Space>
  );
}

function NextListGroup({
  events,
  fromRuntimeName,
  resolverEdgeIndex,
}: {
  events: DebugEvent[];
  fromRuntimeName: string;
  resolverEdgeIndex: DebugModalController["resolverEdgeIndex"];
}) {
  if (events.length === 0) return null;

  return (
    <DebugSection title="Next-list 事件">
      <List
        size="small"
        dataSource={events}
        renderItem={(event) => (
          <List.Item>
            <Space direction="vertical" size={6} style={{ width: "100%" }}>
              <Space wrap size={4}>
                <Tag>#{event.seq}</Tag>
                <Tag>{event.phase ?? "-"}</Tag>
                {event.maafwMessage && <Tag>{event.maafwMessage}</Tag>}
              </Space>
              <Space wrap size={4}>
                {readNextItems(event).map((item, index) => {
                  const edge = findDebugResolverEdge(
                    resolverEdgeIndex,
                    fromRuntimeName,
                    item.name,
                  );
                  return (
                    <Tag key={`${event.seq}-${item.name}-${index}`}>
                      {item.name}
                      {item.jumpBack ? " · jump_back" : ""}
                      {item.anchor ? " · anchor" : ""}
                      {edge ? ` · edge ${edge.edgeId}` : ""}
                    </Tag>
                  );
                })}
              </Space>
            </Space>
          </List.Item>
        )}
      />
    </DebugSection>
  );
}

function SimpleEventGroup({
  events,
  title,
}: {
  events: DebugEvent[];
  title: string;
}) {
  if (events.length === 0) return null;

  return (
    <DebugSection title={title}>
      <List
        size="small"
        dataSource={events}
        renderItem={(event) => (
          <List.Item>
            <Space wrap size={4}>
              <Tag>#{event.seq}</Tag>
              <Tag>{formatTime(event.timestamp)}</Tag>
              <Tag>{event.kind}</Tag>
              {event.phase && <Tag>{event.phase}</Tag>}
              {event.maafwMessage && <Tag>{event.maafwMessage}</Tag>}
              <Text type="secondary">{eventTitle(event)}</Text>
            </Space>
          </List.Item>
        )}
      />
    </DebugSection>
  );
}

function readEventDetail(
  artifacts: ArtifactEntries,
  event: DebugEvent,
): Record<string, unknown> | undefined {
  if (!event.detailRef) return undefined;
  const data = artifacts[event.detailRef]?.payload?.data;
  return isRecord(data) ? data : undefined;
}

function readNextItems(event: DebugEvent): Array<{
  name: string;
  jumpBack?: boolean;
  anchor?: boolean;
}> {
  const next = event.data?.next;
  if (!Array.isArray(next)) return [];
  return next
    .filter(isRecord)
    .map((item) => ({
      name: typeof item.name === "string" ? item.name : String(item.name ?? ""),
      jumpBack: item.jumpBack === true,
      anchor: item.anchor === true,
    }))
    .filter((item) => item.name.trim() !== "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function shortRef(ref: string): string {
  return ref.slice(0, 8);
}
