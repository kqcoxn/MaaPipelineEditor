import { List } from "../../../../components/SimpleList";
import { Typography, Space, Tag, Collapse } from "antd";
import type { CSSProperties } from "react";
import type {
  DebugNodeExecutionRecord,
  DebugNodeExecutionRecordGroup,
} from "../../nodeExecutionSelector";
import { formatDebugNodeExecutionDuration } from "../../nodeExecutionDisplay";
import type { DebugEvent, DebugNodeExecutionStatus } from "../../types";
import type { DebugExecutionDetailMode } from "../../types";
import { formatDebugNodeDisplayName } from "../../syntheticNode";
import { terminalDebugNodeExecutionAttempts } from "../../nodeExecutionAttempts";
import {
  findDebugRunFirstTimestamp,
  formatDebugRunDisplayName,
} from "../../runDisplayName";
import { useDebugComponentT } from "../useDebugComponentT";
import { useTranslation } from "react-i18next";

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
  detailMode,
  events,
  records,
  onSelectRecord,
  selectedRecordId,
}: {
  detailMode: DebugExecutionDetailMode;
  events: DebugEvent[];
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
          runLabel={formatDebugRunDisplayName(
            record.runId,
            findDebugRunFirstTimestamp(record.runId, events),
          )}
          selected={record.id === selectedRecordId}
          detailMode={detailMode}
          onSelectRecord={onSelectRecord}
        />
      )}
    />
  );
}

export function GroupedRecordList({
  detailMode,
  events,
  groups,
  onSelectRecord,
  selectedRecordId,
  totalRecordCount,
}: {
  detailMode: DebugExecutionDetailMode;
  events: DebugEvent[];
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
                  label: <GroupTitle events={events} group={group} />,
                  children: (
                    <List
                      size="small"
                      dataSource={group.records}
                      renderItem={(record) => (
                        <RecordListItem
                          key={record.id}
                          record={record}
                          runLabel={formatDebugRunDisplayName(
                            record.runId,
                            findDebugRunFirstTimestamp(record.runId, events),
                          )}
                          selected={record.id === selectedRecordId}
                          detailMode={detailMode}
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
  const { statusLabel } = useDebugComponentT();
  return <Tag color={statusColors[status]}>{statusLabel(status)}</Tag>;
}

function RecordListItem({
  detailMode,
  record,
  runLabel,
  selected,
  onSelectRecord,
}: {
  detailMode: DebugExecutionDetailMode;
  record: DebugNodeExecutionRecord;
  runLabel: string;
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
        <RecordMeta
          detailMode={detailMode}
          record={record}
          runLabel={runLabel}
        />
      </div>
    </List.Item>
  );
}

function GroupTitle({
  events,
  group,
}: {
  events: DebugEvent[];
  group: DebugNodeExecutionRecordGroup;
}) {
  const { t } = useTranslation();
  return (
    <Space wrap size={4}>
      <Text strong>{group.label ?? group.runtimeName}</Text>
      {group.syntheticKind && (
        <Tag color="purple">
          {t("debug.common.systemRecord", "系统记录")}
        </Tag>
      )}
      <Tag>
        {t("debug.common.run", "运行")}{" "}
        {formatDebugRunDisplayName(
          group.runId,
          findDebugRunFirstTimestamp(group.runId, events),
        )}
      </Tag>
      <Tag>
        {t("debug.nodeExecution.list.times", "{{count}} 次", {
          count: group.occurrenceCount,
        })}
      </Tag>
      <Tag>
        seq {group.firstSeq}-{group.lastSeq}
      </Tag>
      <Tag>
        {t("debug.nodeExecution.list.eventCount", "事件 {{count}}", {
          count: group.eventCount,
        })}
      </Tag>
      {group.hasFailure && (
        <Tag color="red">
          {t("debug.common.withFailure", "含失败")}
        </Tag>
      )}
      {group.hasArtifact && (
        <Tag color="purple">
          {t("debug.common.withArtifact", "含产物")}
        </Tag>
      )}
    </Space>
  );
}

function RecordTitle({ record }: { record: DebugNodeExecutionRecord }) {
  const { t } = useTranslation();
  return (
    <Space wrap size={4}>
      <Text strong>{record.label ?? record.runtimeName}</Text>
      <StatusTag status={record.status} />
      <Tag>
        {t("debug.nodeExecution.details.occurrence", "第 {{count}} 次", {
          count: record.occurrence,
        })}
      </Tag>
      {record.syntheticKind && (
        <Tag color="purple">
          {t("debug.common.systemRecord", "系统记录")}
        </Tag>
      )}
      {record.unmapped && <Tag color="orange">runtimeName-only</Tag>}
      {record.hasFailure && record.status !== "failed" && (
        <Tag color="red">
          {t("debug.common.withFailure", "含失败")}
        </Tag>
      )}
    </Space>
  );
}

function RecordMeta({
  detailMode,
  record,
  runLabel,
}: {
  detailMode: DebugExecutionDetailMode;
  record: DebugNodeExecutionRecord;
  runLabel: string;
}) {
  const { t } = useTranslation();
  const { eventKindLabel } = useDebugComponentT();

  if (detailMode === "compact") {
    return <CompactRecordMeta record={record} runLabel={runLabel} />;
  }

  return (
    <Space wrap size={4} style={{ marginTop: 6 }}>
      <Tag>
        {t("debug.common.run", "运行")} {runLabel}
      </Tag>
      <Tag>{formatDebugNodeDisplayName(record, record.runtimeName)}</Tag>
      {record.fileId && <Tag>{record.fileId}</Tag>}
      {record.nodeId && <Tag>{record.nodeId}</Tag>}
      <Tag>
        seq {record.firstSeq}-{record.lastSeq}
      </Tag>
      {record.durationMs !== undefined && (
        <Tag>
          {t("debug.common.duration", "耗时")}{" "}
          {formatDebugNodeExecutionDuration(record.durationMs)}
          {record.durationSource === "performance" ? " · performance" : ""}
        </Tag>
      )}
      <Tag>
        {t("debug.nodeExecution.list.eventCount", "事件 {{count}}", {
          count: record.eventCount,
        })}
      </Tag>
      <Tag>
        {t("debug.nodeExecution.list.recognitionCount", "识别 {{count}}", {
          count: record.recognitionCount,
        })}
      </Tag>
      <Tag>
        {t("debug.nodeExecution.list.actionCount", "动作 {{count}}", {
          count: record.actionCount,
        })}
      </Tag>
      <Tag>Next {record.nextListCount}</Tag>
      {record.attributionMode === "next" &&
        record.nextCandidateSummary.candidateCount > 0 && (
          <Tag color="blue">
            {t(
              "debug.nodeExecution.list.candidatesSummary",
              "候选 {{candidates}} · 命中 {{hits}} · 映射边 {{edges}}",
              {
                candidates: record.nextCandidateSummary.candidateCount,
                hits: record.nextCandidateSummary.hitCount,
                edges: record.nextCandidateSummary.edgeCount,
              },
            )}
          </Tag>
        )}
      {record.attributionMode === "node" &&
        record.sourceNextOwnerLabel && (
          <Tag color="geekblue">
            {t(
              "debug.common.sourceNextList",
              "来源 {{label}} NextList",
              { label: record.sourceNextOwnerLabel },
            )}
          </Tag>
        )}
      {record.attributionMode === "node" &&
        record.recognitionTargetRuntimeNames.length > 0 && (
          <Tag>
            {t("debug.nodeExecution.list.target", "目标 {{names}}", {
              names: record.recognitionTargetRuntimeNames.slice(0, 3).join(", "),
            })}
          </Tag>
        )}
      <Tag>
        {t("debug.common.artifact", "Artifact")}{" "}
        {record.detailRefs.length + record.screenshotRefs.length}
      </Tag>
      {record.eventKinds.slice(0, 4).map((kind) => (
        <Tag key={kind}>{eventKindLabel(kind)}</Tag>
      ))}
    </Space>
  );
}

function CompactRecordMeta({
  record,
  runLabel,
}: {
  record: DebugNodeExecutionRecord;
  runLabel: string;
}) {
  const { t } = useTranslation();
  const terminalAttempts = terminalDebugNodeExecutionAttempts(record);
  const terminalRecognitionAttempts = terminalAttempts.filter(
    (item) => item.kind === "recognition",
  );
  const terminalActionCount = terminalAttempts.filter(
    (item) => item.kind === "action",
  ).length;
  const hitCount = terminalRecognitionAttempts.filter(
    (attempt) => attempt.hit === true,
  ).length;
  const missCount = terminalRecognitionAttempts.filter(
    (attempt) => attempt.hit === false,
  ).length;
  const terminalRecognitionCount = terminalRecognitionAttempts.length;
  const artifactCount = record.detailRefs.length + record.screenshotRefs.length;

  return (
    <Space wrap size={4} style={{ marginTop: 6 }}>
      <Tag>
        {t("debug.common.run", "运行")} {runLabel}
      </Tag>
      {record.durationMs !== undefined && (
        <Tag>
          {t("debug.common.duration", "耗时")}{" "}
          {formatDebugNodeExecutionDuration(record.durationMs)}
        </Tag>
      )}
      {terminalRecognitionCount > 0 && (
        <Tag>
          {t(
            "debug.nodeExecution.list.recognitionHits",
            "识别 {{count}} · hit {{hits}} · miss {{misses}}",
            {
              count: terminalRecognitionCount,
              hits: hitCount,
              misses: missCount,
            },
          )}
        </Tag>
      )}
      {terminalActionCount > 0 && (
        <Tag>
          {t("debug.nodeExecution.list.actionCount", "动作 {{count}}", {
            count: terminalActionCount,
          })}
        </Tag>
      )}
      {record.nextCandidateSummary.candidateCount > 0 && (
        <Tag color="blue">
          {t(
            "debug.nodeExecution.list.nextSummary",
            "Next {{candidates}} · 命中 {{hits}}",
            {
              candidates: record.nextCandidateSummary.candidateCount,
              hits: record.nextCandidateSummary.hitCount,
            },
          )}
        </Tag>
      )}
      {record.sourceNextOwnerLabel && (
        <Tag color="geekblue">
          {t(
            "debug.common.sourceNextList",
            "来源 {{label}} NextList",
            { label: record.sourceNextOwnerLabel },
          )}
        </Tag>
      )}
      {artifactCount > 0 && (
        <Tag color="purple">
          {t("debug.common.artifact", "Artifact")} {artifactCount}
        </Tag>
      )}
    </Space>
  );
}
