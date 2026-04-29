import { Alert, Button, List, Space, Tag, Typography } from "antd";
import { DebugArtifactPreview } from "../DebugArtifactPreview";
import { DebugSection } from "../DebugSection";
import {
  formatDebugDetailValue,
  recognitionDetailImageRefs,
  summarizeActionArtifactPayload,
  summarizeRecognitionArtifactPayload,
  type DebugDetailImageRef,
} from "../../artifactDetailSummary";
import {
  findDebugResolverEdge,
  type DebugNodeExecutionRecord,
  type ResolverEdge,
} from "../../nodeExecutionSelector";
import { formatDebugNodeExecutionDuration } from "../../nodeExecutionDisplay";
import { eventTitle, formatTime } from "../../modalUtils";
import type { DebugEvent } from "../../types";
import type { DebugArtifactEntry } from "../../../../stores/debugArtifactStore";
import { StatusTag } from "./NodeExecutionRecordList";

const { Text } = Typography;

type ArtifactEntries = Record<string, DebugArtifactEntry>;

export function NodeExecutionRecordDetails({
  artifacts,
  record,
  requestArtifact,
  resolverEdgeIndex,
  selectedArtifact,
}: {
  artifacts: ArtifactEntries;
  record: DebugNodeExecutionRecord;
  requestArtifact: (artifactId: string) => void;
  resolverEdgeIndex: Map<string, ResolverEdge>;
  selectedArtifact?: DebugArtifactEntry;
}) {
  const derivedImageRefs = collectDerivedImageRefs(
    artifacts,
    record.recognitionEvents,
  );
  const relatedArtifactRefs = new Set([
    ...record.detailRefs,
    ...record.screenshotRefs,
    ...derivedImageRefs.map((ref) => ref.ref),
  ]);
  const selectedArtifactIsRelated =
    selectedArtifact && relatedArtifactRefs.has(selectedArtifact.ref.id);

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

      <ArtifactActions
        detailRefs={record.detailRefs}
        derivedImageRefs={derivedImageRefs}
        requestArtifact={requestArtifact}
        screenshotRefs={record.screenshotRefs}
      />

      {selectedArtifactIsRelated && (
        <DebugSection title="已选 Artifact 预览">
          <DebugArtifactPreview artifact={selectedArtifact} />
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
                artifacts={artifacts}
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
  artifacts,
  event,
  kind,
}: {
  artifacts: ArtifactEntries;
  event: DebugEvent;
  kind: "recognition" | "action";
}) {
  const payload = event.detailRef
    ? artifacts[event.detailRef]?.payload
    : undefined;
  const recognitionSummary =
    kind === "recognition"
      ? summarizeRecognitionArtifactPayload(payload)
      : undefined;
  const actionSummary =
    kind === "action" ? summarizeActionArtifactPayload(payload) : undefined;
  const fields: Array<[string, unknown]> =
    kind === "recognition"
      ? [
          ["id", event.data?.id ?? recognitionSummary?.id],
          ["name", event.data?.name ?? recognitionSummary?.name],
          ["hit", event.data?.hit ?? recognitionSummary?.hit],
          ["algorithm", event.data?.algorithm ?? recognitionSummary?.algorithm],
          ["box", event.data?.box ?? recognitionSummary?.box],
          ["combined", recognitionSummary?.combinedResultCount],
        ]
      : [
          ["id", event.data?.id ?? actionSummary?.id],
          ["name", event.data?.name ?? actionSummary?.name],
          ["action", event.data?.action ?? actionSummary?.action],
          ["success", event.data?.success ?? actionSummary?.success],
          ["box", event.data?.box ?? actionSummary?.box],
        ];
  const detail = recognitionSummary?.detail ?? actionSummary?.detail;
  const detailJson =
    recognitionSummary?.detailJson ?? actionSummary?.detailJson;

  return (
    <Space direction="vertical" size={4} style={{ width: "100%" }}>
      <Space wrap size={4}>
        {fields.map(([label, value]) => (
          <Tag key={label}>{`${label}: ${formatDebugDetailValue(value)}`}</Tag>
        ))}
      </Space>
      {detail !== undefined && (
        <Text type="secondary">detail: {truncate(formatDebugDetailValue(detail))}</Text>
      )}
      {detail === undefined && detailJson !== undefined && (
        <Text type="secondary">
          detailJson: {truncate(formatDebugDetailValue(detailJson))}
        </Text>
      )}
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
  resolverEdgeIndex: Map<string, ResolverEdge>;
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

function ArtifactActions({
  detailRefs,
  derivedImageRefs,
  requestArtifact,
  screenshotRefs,
}: {
  detailRefs: string[];
  derivedImageRefs: DebugDetailImageRef[];
  requestArtifact: (artifactId: string) => void;
  screenshotRefs: string[];
}) {
  const hasRefs =
    detailRefs.length > 0 ||
    screenshotRefs.length > 0 ||
    derivedImageRefs.length > 0;

  return (
    <DebugSection title="Artifact">
      {!hasRefs ? (
        <Text type="secondary">该执行记录没有 artifact 引用。</Text>
      ) : (
        <Space direction="vertical" size={8}>
          <ArtifactButtonGroup
            refs={detailRefs.map((ref) => ({
              ref,
              label: `查看详情 #${shortRef(ref)}`,
            }))}
            requestArtifact={requestArtifact}
            title="详情 JSON"
          />
          <ArtifactButtonGroup
            refs={screenshotRefs.map((ref) => ({
              ref,
              label: `查看事件图像 #${shortRef(ref)}`,
            }))}
            requestArtifact={requestArtifact}
            title="事件图像"
          />
          <ArtifactButtonGroup
            refs={derivedImageRefs.map((item) => ({
              ref: item.ref,
              label: `查看${item.label} #${shortRef(item.ref)}`,
            }))}
            requestArtifact={requestArtifact}
            title="详情派生图像"
          />
        </Space>
      )}
    </DebugSection>
  );
}

function ArtifactButtonGroup({
  refs,
  requestArtifact,
  title,
}: {
  refs: Array<{ ref: string; label: string }>;
  requestArtifact: (artifactId: string) => void;
  title: string;
}) {
  if (refs.length === 0) return null;

  return (
    <Space direction="vertical" size={4}>
      <Text type="secondary">{title}</Text>
      <Space wrap>
        {refs.map((item) => (
          <Button
            key={`${title}-${item.ref}-${item.label}`}
            size="small"
            onClick={() => requestArtifact(item.ref)}
          >
            {item.label}
          </Button>
        ))}
      </Space>
    </Space>
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

function collectDerivedImageRefs(
  artifacts: ArtifactEntries,
  events: DebugEvent[],
): DebugDetailImageRef[] {
  const seen = new Set<string>();
  const refs: DebugDetailImageRef[] = [];
  for (const event of events) {
    if (!event.detailRef) continue;
    const summary = summarizeRecognitionArtifactPayload(
      artifacts[event.detailRef]?.payload,
    );
    for (const ref of recognitionDetailImageRefs(summary)) {
      if (seen.has(ref.ref)) continue;
      seen.add(ref.ref);
      refs.push(ref);
    }
  }
  return refs;
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

function truncate(value: string): string {
  return value.length > 240 ? `${value.slice(0, 240)}...` : value;
}

function shortRef(ref: string): string {
  return ref.slice(0, 8);
}
