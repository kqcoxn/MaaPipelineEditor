import type { CSSProperties } from "react";
import { Collapse, List, Space, Tag, Typography } from "antd";
import type {
  DebugNodeExecutionRecord,
  DebugNodeExecutionRecordGroup,
} from "../../nodeExecutionSelector";
import {
  debugNodeExecutionEventKindLabels,
  formatDebugNodeExecutionDuration,
} from "../../nodeExecutionDisplay";
import type { DebugNodeExecutionStatus } from "../../types";

const { Text } = Typography;

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

const listPagination = {
  pageSize: 100,
  size: "small" as const,
  showSizeChanger: false,
};

export function RecordList({
  records,
  onSelectRecord,
  selectedRecordId,
}: {
  records: DebugNodeExecutionRecord[];
  onSelectRecord: (record: DebugNodeExecutionRecord) => void;
  selectedRecordId?: string;
}) {
  return (
    <List
      bordered
      size="small"
      dataSource={records}
      pagination={records.length > 300 ? listPagination : false}
      renderItem={(record) => (
        <RecordListItem
          key={record.id}
          record={record}
          selected={record.id === selectedRecordId}
          onSelectRecord={onSelectRecord}
        />
      )}
    />
  );
}

export function GroupedRecordList({
  groups,
  onSelectRecord,
  selectedRecordId,
  totalRecordCount,
}: {
  groups: DebugNodeExecutionRecordGroup[];
  onSelectRecord: (record: DebugNodeExecutionRecord) => void;
  selectedRecordId?: string;
  totalRecordCount: number;
}) {
  return (
    <List
      bordered
      size="small"
      dataSource={groups}
      pagination={totalRecordCount > 300 ? listPagination : false}
      renderItem={(group) => {
        const selectedInGroup = group.records.some(
          (record) => record.id === selectedRecordId,
        );
        return (
          <List.Item>
            <Collapse
              size="small"
              style={{ width: "100%" }}
              defaultActiveKey={selectedInGroup ? [group.id] : undefined}
              items={[
                {
                  key: group.id,
                  label: <GroupTitle group={group} />,
                  children: (
                    <List
                      size="small"
                      dataSource={group.records}
                      renderItem={(record) => (
                        <RecordListItem
                          key={record.id}
                          record={record}
                          selected={record.id === selectedRecordId}
                          onSelectRecord={onSelectRecord}
                        />
                      )}
                    />
                  ),
                },
              ]}
            />
          </List.Item>
        );
      }}
    />
  );
}

export function StatusTag({ status }: { status: DebugNodeExecutionStatus }) {
  return <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>;
}

function RecordListItem({
  record,
  selected,
  onSelectRecord,
}: {
  record: DebugNodeExecutionRecord;
  selected: boolean;
  onSelectRecord: (record: DebugNodeExecutionRecord) => void;
}) {
  return (
    <List.Item>
      <div
        role="button"
        tabIndex={0}
        style={selected ? selectedItemStyle : selectableItemStyle}
        onClick={() => onSelectRecord(record)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSelectRecord(record);
        }}
      >
        <RecordTitle record={record} />
        <RecordMeta record={record} />
      </div>
    </List.Item>
  );
}

function GroupTitle({ group }: { group: DebugNodeExecutionRecordGroup }) {
  return (
    <Space wrap size={4}>
      <Text strong>{group.label ?? group.runtimeName}</Text>
      <Tag>run {group.runId}</Tag>
      <Tag>{group.occurrenceCount} 次</Tag>
      <Tag>
        seq {group.firstSeq}-{group.lastSeq}
      </Tag>
      <Tag>事件 {group.eventCount}</Tag>
      {group.hasFailure && <Tag color="red">含失败</Tag>}
      {group.slow && <Tag color="volcano">慢节点</Tag>}
      {group.hasArtifact && <Tag color="purple">含产物</Tag>}
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
      {record.hasFailure && <Tag color="red">含失败</Tag>}
      {record.slow && <Tag color="volcano">慢节点</Tag>}
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
      {record.durationMs !== undefined && (
        <Tag>
          耗时 {formatDebugNodeExecutionDuration(record.durationMs)}
          {record.durationSource === "performance" ? " · performance" : ""}
        </Tag>
      )}
      <Tag>事件 {record.eventCount}</Tag>
      <Tag>识别 {record.recognitionCount}</Tag>
      <Tag>动作 {record.actionCount}</Tag>
      <Tag>Next {record.nextListCount}</Tag>
      <Tag>Artifact {record.detailRefs.length + record.screenshotRefs.length}</Tag>
      {record.eventKinds.slice(0, 4).map((kind) => (
        <Tag key={kind}>{debugNodeExecutionEventKindLabels[kind]}</Tag>
      ))}
    </Space>
  );
}
