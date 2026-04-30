import type { CSSProperties } from "react";
import { Button, List, Space, Tag, Typography } from "antd";
import {
  StepBackwardOutlined,
  StepForwardOutlined,
} from "@ant-design/icons";
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
  allDebugNodeExecutionAttempts,
  type DebugNodeExecutionAttempt,
} from "../../nodeExecutionAttempts";
import type { DebugNodeExecutionRecord } from "../../nodeExecutionSelector";
import type { DebugArtifactEntry } from "../../../../stores/debugArtifactStore";

const { Text } = Typography;

type ArtifactEntries = Record<string, DebugArtifactEntry>;

const selectableAttemptStyle: CSSProperties = {
  width: "100%",
  cursor: "pointer",
  borderRadius: 6,
  padding: "4px 6px",
};

const selectedAttemptStyle: CSSProperties = {
  ...selectableAttemptStyle,
  background: "rgba(22, 119, 255, 0.08)",
};

export function NodeExecutionAttemptFocus({
  artifacts,
  onSelectAttempt,
  record,
  requestArtifact,
  selectedArtifact,
  selectedAttemptId,
}: {
  artifacts: ArtifactEntries;
  onSelectAttempt: (attemptId?: string) => void;
  record: DebugNodeExecutionRecord;
  requestArtifact: (artifactId: string) => void;
  selectedArtifact?: DebugArtifactEntry;
  selectedAttemptId?: string;
}) {
  const attempts = allDebugNodeExecutionAttempts(record);
  const selectedAttempt =
    attempts.find((attempt) => attempt.id === selectedAttemptId) ?? attempts[0];
  const selectedIndex = selectedAttempt
    ? attempts.findIndex((attempt) => attempt.id === selectedAttempt.id)
    : -1;
  const derivedImageRefs = selectedAttempt
    ? collectAttemptDerivedImageRefs(artifacts, selectedAttempt)
    : [];
  const relatedArtifactRefs = new Set([
    ...(selectedAttempt?.detailRefs ?? []),
    ...(selectedAttempt?.screenshotRefs ?? []),
    ...derivedImageRefs.map((ref) => ref.ref),
  ]);
  const selectedArtifactIsRelated =
    selectedArtifact && relatedArtifactRefs.has(selectedArtifact.ref.id);

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <DebugSection title="单次识别 / 动作">
        {attempts.length === 0 || !selectedAttempt ? (
          <Text type="secondary">当前记录没有可选择的识别或动作 attempt。</Text>
        ) : (
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            <Space wrap size={6}>
              <Button
                size="small"
                icon={<StepBackwardOutlined />}
                disabled={selectedIndex <= 0}
                onClick={() => onSelectAttempt(attempts[selectedIndex - 1]?.id)}
              >
                上一条
              </Button>
              <Button
                size="small"
                icon={<StepForwardOutlined />}
                disabled={
                  selectedIndex < 0 || selectedIndex >= attempts.length - 1
                }
                onClick={() => onSelectAttempt(attempts[selectedIndex + 1]?.id)}
              >
                下一条
              </Button>
              <Tag>
                {selectedIndex + 1} / {attempts.length}
              </Tag>
            </Space>
            <List
              size="small"
              dataSource={attempts}
              renderItem={(attempt) => (
                <AttemptListItem
                  attempt={attempt}
                  selected={attempt.id === selectedAttempt.id}
                  onSelectAttempt={onSelectAttempt}
                />
              )}
            />
            <AttemptSummary
              artifacts={artifacts}
              attempt={selectedAttempt}
              derivedImageRefs={derivedImageRefs}
              requestArtifact={requestArtifact}
            />
          </Space>
        )}
      </DebugSection>

      {selectedArtifactIsRelated && (
        <DebugSection title="已选 Artifact 预览">
          <DebugArtifactPreview artifact={selectedArtifact} />
        </DebugSection>
      )}
    </Space>
  );
}

function AttemptListItem({
  attempt,
  onSelectAttempt,
  selected,
}: {
  attempt: DebugNodeExecutionAttempt;
  onSelectAttempt: (attemptId?: string) => void;
  selected: boolean;
}) {
  return (
    <List.Item>
      <div
        role="button"
        tabIndex={0}
        style={selected ? selectedAttemptStyle : selectableAttemptStyle}
        onClick={() => onSelectAttempt(attempt.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSelectAttempt(attempt.id);
        }}
      >
        <Space wrap size={4}>
          <Text strong>{attempt.kind === "recognition" ? "识别" : "动作"}</Text>
          <Tag>
            #{attempt.firstSeq}
            {attempt.lastSeq !== attempt.firstSeq ? `-${attempt.lastSeq}` : ""}
          </Tag>
          {attempt.phase && <Tag>{attempt.phase}</Tag>}
          {attempt.kind === "recognition" && attempt.hit !== undefined && (
            <Tag color={attempt.hit ? "green" : "red"}>
              {attempt.hit ? "hit" : "miss"}
            </Tag>
          )}
          {attempt.kind === "action" && attempt.action !== undefined && (
            <Tag>{`action: ${formatDebugDetailValue(attempt.action)}`}</Tag>
          )}
          {attempt.detailRefs.length > 0 && <Tag color="purple">详情</Tag>}
          {attempt.screenshotRefs.length > 0 && <Tag color="cyan">图像</Tag>}
          {attempt.sourceNextOwnerLabel && (
            <Tag color="geekblue">
              来源 {attempt.sourceNextOwnerLabel} NextList
            </Tag>
          )}
        </Space>
      </div>
    </List.Item>
  );
}

function AttemptSummary({
  artifacts,
  attempt,
  derivedImageRefs,
  requestArtifact,
}: {
  artifacts: ArtifactEntries;
  attempt: DebugNodeExecutionAttempt;
  derivedImageRefs: DebugDetailImageRef[];
  requestArtifact: (artifactId: string) => void;
}) {
  const payload = attempt.detailRef
    ? artifacts[attempt.detailRef]?.payload
    : undefined;
  const recognitionSummary =
    attempt.kind === "recognition"
      ? summarizeRecognitionArtifactPayload(payload)
      : undefined;
  const actionSummary =
    attempt.kind === "action" ? summarizeActionArtifactPayload(payload) : undefined;
  const fields: Array<[string, unknown]> =
    attempt.kind === "recognition"
      ? [
          ["id", attempt.dataId ?? recognitionSummary?.id],
          ["target", attempt.targetRuntimeName],
          ["hit", attempt.hit ?? recognitionSummary?.hit],
          ["algorithm", attempt.algorithm ?? recognitionSummary?.algorithm],
          ["box", attempt.box ?? recognitionSummary?.box],
          ["combined", recognitionSummary?.combinedResultCount],
        ]
      : [
          ["id", attempt.dataId ?? actionSummary?.id],
          ["target", attempt.targetRuntimeName],
          ["action", attempt.action ?? actionSummary?.action],
          ["success", attempt.success ?? actionSummary?.success],
          ["box", attempt.box ?? actionSummary?.box],
        ];
  const detail = recognitionSummary?.detail ?? actionSummary?.detail;
  const detailJson =
    recognitionSummary?.detailJson ?? actionSummary?.detailJson;

  return (
    <Space direction="vertical" size={8} style={{ width: "100%" }}>
      <Space wrap size={4}>
        <Tag>{attempt.kind === "recognition" ? "识别 attempt" : "动作 attempt"}</Tag>
        <Tag>
          seq {attempt.firstSeq}
          {attempt.lastSeq !== attempt.firstSeq ? `-${attempt.lastSeq}` : ""}
        </Tag>
        {attempt.phase && <Tag>{attempt.phase}</Tag>}
        {attempt.status && <Tag>{attempt.status}</Tag>}
        {attempt.maafwMessage && <Tag>{attempt.maafwMessage}</Tag>}
        {attempt.sourceNextOwnerLabel && (
          <Tag color="geekblue">
            来源 {attempt.sourceNextOwnerLabel} NextList
          </Tag>
        )}
      </Space>
      <Space wrap size={4}>
        {fields
          .filter(([, value]) => value !== undefined)
          .map(([label, value]) => (
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
      <AttemptArtifactActions
        attempt={attempt}
        derivedImageRefs={derivedImageRefs}
        requestArtifact={requestArtifact}
      />
    </Space>
  );
}

function AttemptArtifactActions({
  attempt,
  derivedImageRefs,
  requestArtifact,
}: {
  attempt: DebugNodeExecutionAttempt;
  derivedImageRefs: DebugDetailImageRef[];
  requestArtifact: (artifactId: string) => void;
}) {
  const hasRefs =
    attempt.detailRefs.length > 0 ||
    attempt.screenshotRefs.length > 0 ||
    derivedImageRefs.length > 0;
  if (!hasRefs) {
    return <Text type="secondary">该 attempt 没有 artifact 引用。</Text>;
  }

  return (
    <Space direction="vertical" size={6}>
      <ArtifactButtonGroup
        refs={attempt.detailRefs.map((ref) => ({
          ref,
          label: `查看详情 #${shortRef(ref)}`,
        }))}
        requestArtifact={requestArtifact}
        title="详情 JSON"
      />
      <ArtifactButtonGroup
        refs={attempt.screenshotRefs.map((ref) => ({
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

function collectAttemptDerivedImageRefs(
  artifacts: ArtifactEntries,
  attempt: DebugNodeExecutionAttempt,
): DebugDetailImageRef[] {
  if (attempt.kind !== "recognition") return [];
  const seen = new Set<string>();
  const refs: DebugDetailImageRef[] = [];
  for (const detailRef of attempt.detailRefs) {
    const summary = summarizeRecognitionArtifactPayload(
      artifacts[detailRef]?.payload,
    );
    for (const ref of recognitionDetailImageRefs(summary)) {
      if (seen.has(ref.ref)) continue;
      seen.add(ref.ref);
      refs.push(ref);
    }
  }
  return refs;
}

function truncate(value: string): string {
  return value.length > 240 ? `${value.slice(0, 240)}...` : value;
}

function shortRef(ref: string): string {
  return ref.slice(0, 8);
}
