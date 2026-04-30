import { useEffect, type CSSProperties } from "react";
import { List, Space, Tag, Typography } from "antd";
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
  allDebugNodeExecutionAttempts,
  terminalDebugNodeExecutionAttempts,
  type DebugNodeExecutionAttempt,
} from "../../nodeExecutionAttempts";
import type { DebugNodeExecutionRecord } from "../../nodeExecutionSelector";
import type { DebugExecutionDetailMode } from "../../types";
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
  detailMode,
  onSelectAttempt,
  record,
  requestArtifact,
  selectedArtifact,
  selectedAttemptId,
}: {
  artifacts: ArtifactEntries;
  detailMode: DebugExecutionDetailMode;
  onSelectAttempt: (attemptId?: string) => void;
  record: DebugNodeExecutionRecord;
  requestArtifact: (artifactId: string) => void;
  selectedArtifact?: DebugArtifactEntry;
  selectedAttemptId?: string;
}) {
  const allAttempts = allDebugNodeExecutionAttempts(record);
  const attempts =
    detailMode === "compact"
      ? terminalDebugNodeExecutionAttempts(record)
      : allAttempts;
  const selectedAttempt =
    attempts.find((attempt) => attempt.id === selectedAttemptId) ?? attempts[0];
  const selectedAttemptIdValue = selectedAttempt?.id;
  const hasSelectedAttempt = Boolean(selectedAttempt);
  const selectedIndex = selectedAttempt
    ? attempts.findIndex((attempt) => attempt.id === selectedAttempt.id)
    : -1;
  useEffect(() => {
    if (selectedAttemptIdValue && selectedAttemptIdValue !== selectedAttemptId) {
      onSelectAttempt(selectedAttemptIdValue);
      return;
    }
    if (!hasSelectedAttempt && selectedAttemptId && attempts.length === 0) {
      onSelectAttempt(undefined);
    }
  }, [
    attempts.length,
    hasSelectedAttempt,
    onSelectAttempt,
    selectedAttemptId,
    selectedAttemptIdValue,
  ]);

  const derivedImageRefs = selectedAttempt
    ? collectAttemptDerivedImageRefs(artifacts, selectedAttempt)
    : [];
  const selectedAttemptBox = selectedAttempt
    ? resolveAttemptPreviewBox(artifacts, selectedAttempt)
    : undefined;

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <DebugSection title="单次识别 / 动作">
        {attempts.length === 0 || !selectedAttempt ? (
          <Text type="secondary">
            {detailMode === "compact"
              ? "当前记录暂无成功 / 失败 attempt。"
              : "当前记录没有可选择的识别或动作 attempt。"}
          </Text>
        ) : (
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
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
            <Text type="secondary">
              {selectedIndex + 1} / {attempts.length}
            </Text>
            <AttemptSummary
              artifacts={artifacts}
              attempt={selectedAttempt}
              derivedImageRefs={derivedImageRefs}
              requestArtifact={requestArtifact}
              selectedArtifact={selectedArtifact}
              selectedAttemptBox={selectedAttemptBox}
            />
          </Space>
        )}
      </DebugSection>
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
          {attempt.kind === "action" && attempt.success !== undefined && (
            <Tag color={attempt.success ? "green" : "red"}>
              {attempt.success ? "success" : "failed"}
            </Tag>
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
  selectedArtifact,
  selectedAttemptBox,
}: {
  artifacts: ArtifactEntries;
  attempt: DebugNodeExecutionAttempt;
  derivedImageRefs: DebugDetailImageRef[];
  requestArtifact: (artifactId: string) => void;
  selectedArtifact?: DebugArtifactEntry;
  selectedAttemptBox?: unknown;
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
      <AttemptArtifactActions
        attempt={attempt}
        derivedImageRefs={derivedImageRefs}
        requestArtifact={requestArtifact}
        selectedArtifact={selectedArtifact}
        selectedAttemptBox={selectedAttemptBox}
      />
    </Space>
  );
}

function AttemptArtifactActions({
  attempt,
  derivedImageRefs,
  requestArtifact,
  selectedArtifact,
  selectedAttemptBox,
}: {
  attempt: DebugNodeExecutionAttempt;
  derivedImageRefs: DebugDetailImageRef[];
  requestArtifact: (artifactId: string) => void;
  selectedArtifact?: DebugArtifactEntry;
  selectedAttemptBox?: unknown;
}) {
  return (
    <DebugArtifactSelector
      box={selectedAttemptBox}
      emptyText="该 attempt 没有 artifact 引用。"
      groups={[
        {
          title: "详情 JSON",
          refs: attempt.detailRefs.map((ref) => ({
            ref,
            label: `详情 #${shortRef(ref)}`,
          })),
        },
        {
          title: "事件图像",
          refs: attempt.screenshotRefs.map((ref) => ({
            ref,
            label: `图像 #${shortRef(ref)}`,
          })),
        },
        {
          title: "详情派生图像",
          refs: derivedImageRefs.map((item) => ({
            ref: item.ref,
            label: `${item.label} #${shortRef(item.ref)}`,
          })),
        },
      ]}
      requestArtifact={requestArtifact}
      selectedArtifact={selectedArtifact}
    />
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

function resolveAttemptPreviewBox(
  artifacts: ArtifactEntries,
  attempt: DebugNodeExecutionAttempt,
): unknown {
  if (attempt.box !== undefined) return attempt.box;
  const payload = attempt.detailRef
    ? artifacts[attempt.detailRef]?.payload
    : undefined;
  if (attempt.kind === "recognition") {
    return summarizeRecognitionArtifactPayload(payload)?.box;
  }
  return summarizeActionArtifactPayload(payload)?.box;
}

function shortRef(ref: string): string {
  return ref.slice(0, 8);
}
