import { List } from "../../../../components/SimpleList";
import { Typography, Space, Tag, Alert } from "antd";
import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { DebugArtifactSelector } from "../DebugArtifactSelector";
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
import {
  allDebugNodeExecutionAttempts,
  isArtifactRelatedToAttempt,
} from "../../nodeExecutionAttempts";
import { formatDebugNodeExecutionDuration } from "../../nodeExecutionDisplay";
import { eventTitle, formatTime } from "../../modalUtils";
import type { DebugEvent, DebugExecutionDetailMode } from "../../types";
import { formatDebugNodeDisplayName } from "../../syntheticNode";
import type { DebugArtifactEntry } from "../../../../stores/debugArtifactStore";
import { StatusTag } from "./NodeExecutionRecordList";
import {
  findDebugRunFirstTimestamp,
  formatDebugRunDisplayName,
} from "../../runDisplayName";
import { NodeExecutionAttemptFocus } from "./NodeExecutionAttemptFocus";

const { Text } = Typography;

type ArtifactEntries = Record<string, DebugArtifactEntry>;

const overviewMetaStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  columnGap: 16,
  rowGap: 6,
  width: "100%",
};

const overviewMetaItemStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 4,
  minWidth: 0,
  overflowWrap: "anywhere",
};

const overviewMetaItemWideStyle: CSSProperties = {
  ...overviewMetaItemStyle,
  flex: "1 1 260px",
};

const overviewMetaValueStyle: CSSProperties = {
  minWidth: 0,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

export function NodeExecutionRecordDetails({
  artifacts,
  detailMode,
  events,
  onSelectAttempt,
  record,
  requestArtifact,
  resolverEdgeIndex,
  selectedArtifact,
  selectedAttemptId,
}: {
  artifacts: ArtifactEntries;
  detailMode: DebugExecutionDetailMode;
  events: DebugEvent[];
  onSelectAttempt: (attemptId?: string) => void;
  record: DebugNodeExecutionRecord;
  requestArtifact: (artifactId: string) => void;
  resolverEdgeIndex: Map<string, ResolverEdge>;
  selectedArtifact?: DebugArtifactEntry;
  selectedAttemptId?: string;
}) {
  const { t } = useTranslation();
  const derivedImageRefs = collectDerivedImageRefs(
    artifacts,
    record.recognitionEvents,
    t,
  );
  const selectedAttempt = allDebugNodeExecutionAttempts(record).find(
    (attempt) => attempt.id === selectedAttemptId,
  );
  const selectedArtifactIsAttemptRelated = isArtifactRelatedToAttempt(
    selectedArtifact?.ref.id,
    selectedAttempt,
  ) || isArtifactRelatedToAttemptDerivedImage(
    artifacts,
    selectedArtifact?.ref.id,
    selectedAttempt,
  );
  return (
    <Space orientation="vertical" size={12} style={{ width: "100%" }}>
      <DebugSection
        title={t("debug.nodeExecution.details.overview", "执行概览")}
        collapsible
        defaultCollapsed
      >
        <Space orientation="vertical" size={8} style={{ width: "100%" }}>
          <StatusTag status={record.status} />
          <div style={overviewMetaStyle}>
            <OverviewMetaItem
              label={t("debug.common.run", "运行")}
              value={formatDebugRunDisplayName(
                record.runId,
                findDebugRunFirstTimestamp(record.runId, events),
              )}
            />
            <OverviewMetaItem
              label={t(
                "debug.nodeExecution.details.occurrenceLabel",
                "命中",
              )}
              value={t(
                "debug.nodeExecution.details.occurrence",
                "第 {{count}} 次",
                { count: record.occurrence },
              )}
            />
            <OverviewMetaItem
              label="seq"
              value={`${record.firstSeq}-${record.lastSeq}`}
            />
            {record.durationMs !== undefined && (
              <OverviewMetaItem
                label={t("debug.common.duration", "耗时")}
                value={`${formatDebugNodeExecutionDuration(record.durationMs)}${
                  record.durationSource === "performance"
                    ? " · performance"
                    : ""
                }`}
              />
            )}
            <OverviewMetaItem
              label="runtime"
              value={formatDebugNodeDisplayName(record, record.runtimeName)}
              wide
            />
            {record.syntheticKind && (
              <OverviewMetaItem
                label={t("debug.common.type", "类型")}
                value={t("debug.common.systemRecord", "系统记录")}
              />
            )}
            {record.sourcePath && (
              <OverviewMetaItem
                label={t("debug.common.path", "路径")}
                value={record.sourcePath}
                wide
              />
            )}
            {record.hasFailure && record.status !== "failed" && (
              <OverviewMetaItem
                label={t("debug.common.result", "结果")}
                value={t("debug.common.withFailure", "含失败")}
              />
            )}
            {record.hasArtifact && (
              <OverviewMetaItem
                label={t("debug.common.artifact", "产物")}
                value={t("debug.common.withArtifact", "含产物")}
              />
            )}
          </div>
        </Space>
      </DebugSection>

      {record.unmapped && (
        <Alert
          type="warning"
          showIcon
          title={t(
            "debug.nodeExecution.details.unmappedTitle",
            "该记录未映射到 MPE 图节点",
          )}
          description={t(
            "debug.nodeExecution.details.unmappedDesc",
            "面板保留 runtimeName 事件；画布定位需要 fileId/nodeId 映射。",
          )}
        />
      )}

      <NodeExecutionAttemptFocus
        artifacts={artifacts}
        detailMode={detailMode}
        onSelectAttempt={onSelectAttempt}
        record={record}
        requestArtifact={requestArtifact}
        selectedArtifact={selectedArtifact}
        selectedAttemptId={selectedAttemptId}
      />

      {detailMode === "compact" ? (
        <>
          <CompactNextSummary record={record} />
          <SimpleEventGroup
            events={record.events.filter((event) => event.kind === "diagnostic")}
            title={t(
              "debug.nodeExecution.details.diagnosticEvents",
              "诊断事件",
            )}
          />
        </>
      ) : (
        <>
          <EventGroup
            artifacts={artifacts}
            events={record.recognitionEvents}
            kind="recognition"
            record={record}
            title={t(
              "debug.nodeExecution.details.recognitionEvents",
              "识别事件",
            )}
          />
          <EventGroup
            artifacts={artifacts}
            events={record.actionEvents}
            kind="action"
            record={record}
            title={t(
              "debug.nodeExecution.details.actionEvents",
              "动作事件",
            )}
          />
          <NextListGroup
            events={record.nextListEvents}
            fromRuntimeName={record.runtimeName}
            record={record}
            resolverEdgeIndex={resolverEdgeIndex}
          />
          <SimpleEventGroup
            events={record.waitFreezesEvents}
            title={t(
              "debug.nodeExecution.details.waitFreezes",
              "WaitFreezes",
            )}
          />
          <SimpleEventGroup
            events={record.events.filter((event) => event.kind === "diagnostic")}
            title={t(
              "debug.nodeExecution.details.diagnosticEvents",
              "诊断事件",
            )}
          />

          <ArtifactActions
            detailRefs={record.detailRefs}
            derivedImageRefs={derivedImageRefs}
            requestArtifact={requestArtifact}
            selectedArtifact={
              selectedArtifactIsAttemptRelated ? undefined : selectedArtifact
            }
            screenshotRefs={record.screenshotRefs}
          />

          <SimpleEventGroup
            events={record.events.filter((event) => event.maafwMessage)}
            title={t(
              "debug.nodeExecution.details.maafwRawMessages",
              "MaaFW 原始消息",
            )}
          />
        </>
      )}
    </Space>
  );
}

function CompactNextSummary({
  record,
}: {
  record: DebugNodeExecutionRecord;
}) {
  const { t } = useTranslation();
  const candidates = record.nextCandidateSummary.candidates;
  if (record.nextListCount === 0 && candidates.length === 0) return null;

  return (
    <DebugSection
      title={t("debug.nodeExecution.details.nextSummary", "Next 摘要")}
    >
      {candidates.length === 0 ? (
        <Text type="secondary">
          {t(
            "debug.nodeExecution.details.noNextCandidates",
            "该记录没有可展示的 next 候选。",
          )}
        </Text>
      ) : (
        <Space orientation="vertical" size={6} style={{ width: "100%" }}>
          <Space wrap size={4}>
            <Tag>
              {t(
                "debug.nodeExecution.details.candidates",
                "候选 {{count}}",
                { count: record.nextCandidateSummary.candidateCount },
              )}
            </Tag>
            <Tag color="green">
              {t("debug.nodeExecution.details.hits", "命中 {{count}}", {
                count: record.nextCandidateSummary.hitCount,
              })}
            </Tag>
            <Tag color="red">
              {t("debug.nodeExecution.details.misses", "失败 {{count}}", {
                count: record.nextCandidateSummary.missCount,
              })}
            </Tag>
            <Tag>
              {t(
                "debug.nodeExecution.details.mappedEdges",
                "已映射边 {{count}}",
                { count: record.nextCandidateSummary.edgeCount },
              )}
            </Tag>
            {record.nextCandidateSummary.jumpBackCount > 0 && (
              <Tag>jump_back {record.nextCandidateSummary.jumpBackCount}</Tag>
            )}
            {record.nextCandidateSummary.anchorCount > 0 && (
              <Tag>anchor {record.nextCandidateSummary.anchorCount}</Tag>
            )}
          </Space>
          <Space wrap size={4}>
            {candidates.map((candidate) => (
              <Tag key={candidate.runtimeName}>
                {candidate.label ?? candidate.runtimeName}
                {candidate.hit === true ? " · hit" : ""}
                {candidate.hit === false ? " · miss" : ""}
                {candidate.edgeId
                  ? ` · ${t("debug.common.mappedEdge", "已映射边")}`
                  : ""}
                {candidate.unmappedEdge
                  ? ` · ${t("debug.common.unmappedEdge", "未映射边")}`
                  : ""}
                {candidate.jumpBack ? " · jump_back" : ""}
                {candidate.anchor ? " · anchor" : ""}
                {candidate.recognitionSeqs.length > 0
                  ? ` · reco #${candidate.recognitionSeqs.join(",")}`
                  : ""}
              </Tag>
            ))}
          </Space>
        </Space>
      )}
    </DebugSection>
  );
}

function OverviewMetaItem({
  label,
  value,
  wide,
}: {
  label: string;
  value: ReactNode;
  wide?: boolean;
}) {
  return (
    <span style={wide ? overviewMetaItemWideStyle : overviewMetaItemStyle}>
      <Text type="secondary">{label}</Text>
      <Text style={overviewMetaValueStyle}>{value}</Text>
    </span>
  );
}

function EventGroup({
  artifacts,
  events,
  kind,
  record,
  title,
}: {
  artifacts: ArtifactEntries;
  events: DebugEvent[];
  kind: "recognition" | "action";
  record: DebugNodeExecutionRecord;
  title: string;
}) {
  const { t } = useTranslation();
  if (events.length === 0) return null;

  return (
    <DebugSection title={title}>
      <List
        size="small"
        dataSource={events}
        renderItem={(event) => (
          <List.Item>
            <Space orientation="vertical" size={4} style={{ width: "100%" }}>
              <Space wrap size={4}>
                <Tag>#{event.seq}</Tag>
                <Tag>{event.phase ?? "-"}</Tag>
                {event.maafwMessage && <Tag>{event.maafwMessage}</Tag>}
                {event.detailRef && (
                  <Tag color="purple">
                    {t("debug.common.detail", "详情")}
                  </Tag>
                )}
                {event.screenshotRef && (
                  <Tag color="cyan">
                    {t("debug.common.image", "图像")}
                  </Tag>
                )}
                {kind === "recognition" &&
                  record.attributionMode === "node" &&
                  event.data?.parentNode &&
                  event.data.parentNode !== record.runtimeName && (
                    <Tag color="geekblue">
                      {t(
                        "debug.common.sourceNextList",
                        "来源 {{label}} NextList",
                        {
                          label:
                            record.sourceNextOwnerLabel ?? event.data.parentNode,
                        },
                      )}
                    </Tag>
                  )}
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
  return (
    <Space orientation="vertical" size={4} style={{ width: "100%" }}>
      <Space wrap size={4}>
        {fields.map(([label, value]) => (
          <Tag key={label}>{`${label}: ${formatDebugDetailValue(value)}`}</Tag>
        ))}
      </Space>
    </Space>
  );
}

function NextListGroup({
  events,
  fromRuntimeName,
  record,
  resolverEdgeIndex,
}: {
  events: DebugEvent[];
  fromRuntimeName: string;
  record: DebugNodeExecutionRecord;
  resolverEdgeIndex: Map<string, ResolverEdge>;
}) {
  const { t } = useTranslation();
  if (events.length === 0) return null;

  return (
    <DebugSection
      title={t(
        "debug.nodeExecution.details.nextListEvents",
        "Next-list 事件",
      )}
    >
      <List
        size="small"
        dataSource={events}
        renderItem={(event) => (
          <List.Item>
            <Space orientation="vertical" size={6} style={{ width: "100%" }}>
              <Space wrap size={4}>
                <Tag>#{event.seq}</Tag>
                <Tag>{event.phase ?? "-"}</Tag>
                {event.maafwMessage && <Tag>{event.maafwMessage}</Tag>}
              </Space>
              <Space wrap size={4}>
                {readNextItems(event).map((item, index) => {
                  const candidate =
                    record.nextCandidateSummary.candidates.find(
                      (value) => value.runtimeName === item.name,
                    );
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
                      {candidate?.hit === true ? " · hit" : ""}
                      {candidate?.hit === false ? " · miss" : ""}
                      {edge
                        ? ` · ${t("debug.common.mappedEdge", "已映射边")}`
                        : ""}
                      {!edge && !record.syntheticKind
                        ? ` · ${t("debug.common.unmappedEdge", "未映射边")}`
                        : ""}
                    </Tag>
                  );
                })}
              </Space>
              {record.nextCandidateSummary.candidates.length > 0 && (
                <Space wrap size={4}>
                  <Tag>
                    {t(
                      "debug.nodeExecution.details.candidates",
                      "候选 {{count}}",
                      { count: record.nextCandidateSummary.candidateCount },
                    )}
                  </Tag>
                  <Tag color="green">
                    {t("debug.nodeExecution.details.hits", "命中 {{count}}", {
                      count: record.nextCandidateSummary.hitCount,
                    })}
                  </Tag>
                  <Tag color="red">
                    {t("debug.nodeExecution.details.misses", "失败 {{count}}", {
                      count: record.nextCandidateSummary.missCount,
                    })}
                  </Tag>
                  <Tag>
                    {t(
                      "debug.nodeExecution.details.mappedEdges",
                      "已映射边 {{count}}",
                      { count: record.nextCandidateSummary.edgeCount },
                    )}
                  </Tag>
                </Space>
              )}
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
  selectedArtifact,
  screenshotRefs,
}: {
  detailRefs: string[];
  derivedImageRefs: DebugDetailImageRef[];
  requestArtifact: (artifactId: string) => void;
  selectedArtifact?: DebugArtifactEntry;
  screenshotRefs: string[];
}) {
  const { t } = useTranslation();
  const imageRefs = mergeRecordImageRefs(derivedImageRefs, screenshotRefs, t);
  const hasRefs = detailRefs.length > 0 || imageRefs.length > 0;

  return (
    <DebugSection title={t("debug.common.artifact", "Artifact")}>
      {!hasRefs ? (
        <Text type="secondary">
          {t(
            "debug.artifact.emptyRecord",
            "该执行记录没有 artifact 引用。",
          )}
        </Text>
      ) : (
        <DebugArtifactSelector
          groups={[
            {
              title: t("debug.common.detailJson", "详情 JSON"),
              refs: detailRefs.map((ref) => ({
                ref,
                label: t("debug.common.detailJson", "详情 JSON"),
              })),
            },
            {
              title: t("debug.common.image", "图像"),
              refs: imageRefs.map((item) => ({
                ref: item.ref,
                label: item.label,
              })),
            },
          ]}
          requestArtifact={requestArtifact}
          selectedArtifact={selectedArtifact}
        />
      )}
    </DebugSection>
  );
}

function mergeRecordImageRefs(
  derivedImageRefs: DebugDetailImageRef[],
  screenshotRefs: string[],
  t: TFunction,
): DebugDetailImageRef[] {
  const seen = new Set<string>();
  const result: DebugDetailImageRef[] = [];
  for (const ref of derivedImageRefs) {
    if (seen.has(ref.ref)) continue;
    seen.add(ref.ref);
    result.push(ref);
  }
  for (const ref of screenshotRefs) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    result.push({
      ref,
      kind: "screenshot",
      label: t("debug.common.image", "图像"),
    });
  }
  return result;
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
  t: TFunction,
): DebugDetailImageRef[] {
  const seen = new Set<string>();
  const refs: DebugDetailImageRef[] = [];
  for (const event of events) {
    // 优先从 event data 中读取图像 refs（不需要等 detail JSON 加载）
    const rawImageRef =
      typeof event.data?.rawImageRef === "string" && event.data.rawImageRef.trim() !== ""
        ? event.data.rawImageRef.trim()
        : undefined;
    if (rawImageRef && !seen.has(rawImageRef)) {
      seen.add(rawImageRef);
      refs.push({
        ref: rawImageRef,
        kind: "raw",
        label: t("debug.common.rawImage", "原图"),
      });
    }
    const drawImageRefs = readStringArray(event.data?.drawImageRefs);
    for (const [index, ref] of drawImageRefs.entries()) {
      if (seen.has(ref)) continue;
      seen.add(ref);
      refs.push({
        ref,
        kind: "draw",
        label:
          drawImageRefs.length > 1
            ? t("debug.common.drawImageIndexed", "绘制图 {{index}}", {
                index: index + 1,
              })
            : t("debug.common.drawImage", "绘制图"),
      });
    }

    // 再从已加载的 detail JSON payload 中解析（作为补充和兜底）
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

function readStringArray(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && item.trim() !== "",
  );
}

function isArtifactRelatedToAttemptDerivedImage(
  artifacts: ArtifactEntries,
  artifactId: string | undefined,
  attempt: ReturnType<typeof allDebugNodeExecutionAttempts>[number] | undefined,
): boolean {
  if (!artifactId || attempt?.kind !== "recognition") return false;
  return attempt.detailRefs.some((detailRef) =>
    recognitionDetailImageRefs(
      summarizeRecognitionArtifactPayload(artifacts[detailRef]?.payload),
    ).some((ref) => ref.ref === artifactId),
  );
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
