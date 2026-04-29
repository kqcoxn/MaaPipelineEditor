import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Alert, Button, Empty, List, Select, Space, Tag, Typography } from "antd";
import { AimOutlined, ClearOutlined } from "@ant-design/icons";
import { DebugSection } from "../DebugSection";
import type { DebugModalController } from "../../hooks/useDebugModalController";
import type { DebugNodeExecutionRecord } from "../../nodeExecutionSelector";
import { findDebugResolverEdge } from "../../nodeExecutionSelector";
import type {
  DebugEvent,
  DebugNodeExecutionStatus,
  DebugNodeExecutionStatusFilter,
} from "../../types";
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

const selectableItemStyle: CSSProperties = {
  width: "100%",
  cursor: "pointer",
  borderRadius: 6,
  padding: "4px 6px",
};

const selectedItemStyle: CSSProperties = {
  ...selectableItemStyle,
  background: "rgba(22, 119, 255, 0.08)",
};

const preStyle: CSSProperties = {
  whiteSpace: "pre-wrap",
  margin: 0,
  maxHeight: 280,
  overflow: "auto",
};

const statusLabels: Record<DebugNodeExecutionStatus, string> = {
  running: "运行中",
  succeeded: "成功",
  failed: "失败",
  visited: "已访问",
};

const statusColors: Record<DebugNodeExecutionStatus, string> = {
  running: "blue",
  succeeded: "green",
  failed: "red",
  visited: "default",
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

export function NodeExecutionPanel({
  controller,
}: {
  controller: DebugModalController;
}) {
  const {
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
    selectNodeExecutionRecord,
    setNodeExecutionFilters,
    summary,
  } = controller;
  const [selectedRecordId, setSelectedRecordId] = useState<string>();
  const rawNodeExecutionCount = useMemo(
    () => Object.values(summary.nodeReplays).flat().length,
    [summary.nodeReplays],
  );
  const selectedFlowNode = pipelineNodes.find(
    (node) => node.nodeId === selectedFlowNodeId,
  );
  const selectedRecord =
    nodeExecutionRecords.find((record) => record.id === selectedRecordId) ??
    nodeExecutionRecords[0];

  useEffect(() => {
    if (!selectedRecord) {
      setSelectedRecordId(undefined);
      return;
    }
    if (selectedRecord.id !== selectedRecordId) {
      setSelectedRecordId(selectedRecord.id);
    }
  }, [selectedRecord, selectedRecordId]);

  const nodeOptions = useMemo(
    () => [
      { value: "", label: "全部节点" },
      ...pipelineNodes.map((node) => ({
        value: node.nodeId,
        label: `${node.displayName} · ${node.runtimeName}`,
      })),
    ],
    [pipelineNodes],
  );

  const handleSelectRecord = (record: DebugNodeExecutionRecord) => {
    setSelectedRecordId(record.id);
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
    setNodeExecutionFilters({ status: "all" });
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
          <Tag>记录 {nodeExecutionRecords.length}</Tag>
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
      ) : (
        <div style={layoutStyle}>
          <div style={listPaneStyle}>
            <List
              bordered
              size="small"
              dataSource={nodeExecutionRecords}
              renderItem={(record) => (
                <List.Item>
                  <div
                    role="button"
                    tabIndex={0}
                    style={
                      record.id === selectedRecord?.id
                        ? selectedItemStyle
                        : selectableItemStyle
                    }
                    onClick={() => handleSelectRecord(record)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleSelectRecord(record);
                    }}
                  >
                    <RecordTitle record={record} />
                    <RecordMeta record={record} />
                  </div>
                </List.Item>
              )}
            />
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

function RecordTitle({ record }: { record: DebugNodeExecutionRecord }) {
  return (
    <Space wrap size={4}>
      <Text strong>{record.label ?? record.runtimeName}</Text>
      <StatusTag status={record.status} />
      <Tag>第 {record.occurrence} 次</Tag>
      {record.unmapped && <Tag color="orange">runtimeName-only</Tag>}
    </Space>
  );
}

function RecordMeta({ record }: { record: DebugNodeExecutionRecord }) {
  return (
    <Space wrap size={4} style={{ marginTop: 6 }}>
      <Tag>{record.runtimeName}</Tag>
      {record.fileId && <Tag>{record.fileId}</Tag>}
      {record.nodeId && <Tag>{record.nodeId}</Tag>}
      <Tag>
        seq {record.firstSeq}-{record.lastSeq}
      </Tag>
      <Tag>事件 {record.eventCount}</Tag>
      <Tag>识别 {record.recognitionCount}</Tag>
      <Tag>动作 {record.actionCount}</Tag>
      <Tag>Next {record.nextListCount}</Tag>
      <Tag>Artifact {record.detailRefs.length + record.screenshotRefs.length}</Tag>
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
          <Tag>runtime {record.runtimeName}</Tag>
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

function StatusTag({ status }: { status: DebugNodeExecutionStatus }) {
  return <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>;
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
