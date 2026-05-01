import type { DebugArtifactEntry } from "../../stores/debugArtifactStore";
import type { DebugAiSummaryFocus } from "../../stores/debugAiSummaryStore";
import type { DebugNodeExecutionRecord } from "./nodeExecutionSelector";
import type {
  DebugDiagnostic,
  DebugEvent,
  DebugPerformanceSummary,
} from "./types";

const MAX_EVENTS = 120;
const MAX_ARTIFACTS = 24;
const MAX_ARTIFACT_TEXT = 1600;
const MAX_FAILED_RECORDS = 12;

export interface DebugAiSummaryInput {
  focus: DebugAiSummaryFocus;
  sessionId?: string;
  runId?: string;
  status?: string;
  mode?: string;
  displaySessionId?: string;
  events: DebugEvent[];
  diagnostics: DebugDiagnostic[];
  artifacts: Record<string, DebugArtifactEntry>;
  performanceSummary?: DebugPerformanceSummary;
  nodeRecords: DebugNodeExecutionRecord[];
  selectedNodeRecord?: DebugNodeExecutionRecord;
}

export interface ParsedDebugAiSummary {
  simpleSummary: string;
  detailedReport: string;
}

export function buildDebugAiSummaryPrompt(input: DebugAiSummaryInput): {
  prompt: string;
  contextText: string;
} {
  const context = {
    task: input.focus === "node" ? "node-debug-explanation" : "run-debug-report",
    focus: input.focus,
    target: {
      sessionId: input.sessionId,
      runId: input.runId,
      displaySessionId: input.displaySessionId,
      status: input.status,
      mode: input.mode,
    },
    selectedNode: input.selectedNodeRecord
      ? summarizeNodeRecord(input.selectedNodeRecord)
      : undefined,
    failedNodes: input.nodeRecords
      .filter((record) => record.hasFailure)
      .slice(0, MAX_FAILED_RECORDS)
      .map(summarizeNodeRecord),
    nodeRecords: input.nodeRecords.slice(0, 40).map(summarizeNodeRecord),
    diagnostics: input.diagnostics.slice(0, 40).map((diagnostic) => ({
      severity: diagnostic.severity,
      code: diagnostic.code,
      message: sanitizeText(diagnostic.message),
      fileId: diagnostic.fileId,
      nodeId: diagnostic.nodeId,
      fieldPath: diagnostic.fieldPath,
      sourcePath: sanitizePath(diagnostic.sourcePath),
      data: compactValue(diagnostic.data),
    })),
    performance: input.performanceSummary
      ? {
          eventCount: input.performanceSummary.eventCount,
          nodeCount: input.performanceSummary.nodeCount,
          recognitionCount: input.performanceSummary.recognitionCount,
          actionCount: input.performanceSummary.actionCount,
          diagnosticCount: input.performanceSummary.diagnosticCount,
          artifactRefCount: input.performanceSummary.artifactRefCount,
          screenshotRefCount: input.performanceSummary.screenshotRefCount,
          durationMs: input.performanceSummary.durationMs,
        }
      : undefined,
    events: selectImportantEvents(input.events).map(summarizeEvent),
    artifacts: summarizeArtifacts(input.artifacts),
  };
  const contextText = JSON.stringify(context, null, 2);
  const prompt = [
    "你是 MaaPipelineEditor 调试报告助手。",
    "请基于用户提供的结构化调试上下文，生成中文调试总结。",
    "必须遵守：",
    "- 不要编造未出现在上下文中的节点、事件、产物或错误。",
    "- 所有结论尽量引用证据，例如节点名、nodeId、runtimeName、seq、diagnostic code、artifact id。",
    "- 当 focus 为 failure 时，优先输出失败原因和异常证据，弱化正常节点描述。",
    "- 当 focus 为 node 时，只解释 selectedNode，不要扩展成全局运行报告。",
    "- 不做慢节点/性能瓶颈专项分析；性能字段只能作为辅助背景。",
    "- 如果证据不足，请明确说证据不足，并给出下一步应该查看的调试视图。",
    "- 输出必须是 JSON，不要包裹 Markdown 代码块。",
    "",
    "JSON 格式：",
    "{",
    '  "simpleSummary": "面向中控台的一段短摘要，控制在 120 个中文字符以内",',
    '  "detailedReport": "Markdown 格式详细报告，包含：整体结论、运行概况、失败/异常节点、关键证据、建议下一步"',
    "}",
    "",
    "调试上下文：",
    contextText,
  ].join("\n");
  return { prompt, contextText };
}

export function parseDebugAiSummaryResponse(
  content: string,
): ParsedDebugAiSummary {
  const trimmed = stripCodeFence(content.trim());
  try {
    const parsed = JSON.parse(trimmed) as Partial<ParsedDebugAiSummary>;
    const detailedReport = normalizeReportText(parsed.detailedReport);
    const simpleSummary = normalizeSimpleSummary(parsed.simpleSummary) ||
      firstMeaningfulLine(detailedReport) ||
      "AI 总结已生成，打开详细报告查看。";
    return {
      simpleSummary,
      detailedReport: detailedReport || content.trim(),
    };
  } catch {
    return {
      simpleSummary:
        firstMeaningfulLine(trimmed) || "AI 总结已生成，打开详细报告查看。",
      detailedReport: trimmed,
    };
  }
}

function summarizeNodeRecord(record: DebugNodeExecutionRecord) {
  return {
    id: record.id,
    runId: record.runId,
    runMode: record.runMode,
    nodeId: record.nodeId,
    fileId: record.fileId,
    runtimeName: record.runtimeName,
    label: record.label,
    sourcePath: sanitizePath(record.sourcePath),
    syntheticKind: record.syntheticKind,
    status: record.status,
    occurrence: record.occurrence,
    seqRange: `${record.firstSeq}-${record.lastSeq}`,
    durationMs: record.durationMs,
    hasFailure: record.hasFailure,
    hasArtifact: record.hasArtifact,
    eventKinds: record.eventKinds,
    eventCount: record.eventCount,
    recognitionCount: record.recognitionCount,
    actionCount: record.actionCount,
    nextListCount: record.nextListCount,
    waitFreezesCount: record.waitFreezesCount,
    diagnosticCount: record.diagnosticCount,
    detailRefs: record.detailRefs.slice(0, 8),
    screenshotRefs: record.screenshotRefs.slice(0, 8),
    recognitionAttempts: record.recognitionAttempts.slice(0, 8).map((attempt) => ({
      id: attempt.id,
      seqRange: `${attempt.firstSeq}-${attempt.lastSeq}`,
      status: attempt.status,
      phase: attempt.phase,
      hit: attempt.hit,
      detailRef: attempt.detailRef,
      screenshotRef: attempt.screenshotRef,
      maafwMessages: attempt.maafwMessages.slice(0, 4),
    })),
    actionAttempts: record.actionAttempts.slice(0, 8).map((attempt) => ({
      id: attempt.id,
      seqRange: `${attempt.firstSeq}-${attempt.lastSeq}`,
      status: attempt.status,
      phase: attempt.phase,
      success: attempt.success,
      detailRef: attempt.detailRef,
      screenshotRef: attempt.screenshotRef,
      maafwMessages: attempt.maafwMessages.slice(0, 4),
    })),
    nextCandidates: record.nextCandidateSummary.candidates
      .slice(0, 12)
      .map((candidate) => ({
        runtimeName: candidate.runtimeName,
        label: candidate.label,
        hit: candidate.hit,
        edgeId: candidate.edgeId,
        recognitionSeqs: candidate.recognitionSeqs.slice(0, 8),
        detailRefs: candidate.detailRefs.slice(0, 8),
      })),
  };
}

function summarizeEvent(event: DebugEvent) {
  return {
    seq: event.seq,
    timestamp: event.timestamp,
    source: event.source,
    kind: event.kind,
    phase: event.phase,
    status: event.status,
    maafwMessage: event.maafwMessage,
    node: event.node
      ? {
          runtimeName: event.node.runtimeName,
          fileId: event.node.fileId,
          nodeId: event.node.nodeId,
          label: event.node.label,
          syntheticKind: event.node.syntheticKind,
        }
      : undefined,
    edge: event.edge,
    detailRef: event.detailRef,
    screenshotRef: event.screenshotRef,
    data: compactValue(event.data),
  };
}

function summarizeArtifacts(artifacts: Record<string, DebugArtifactEntry>) {
  return Object.values(artifacts)
    .filter((entry) => entry.status === "ready" || entry.ref.type !== "image")
    .slice(0, MAX_ARTIFACTS)
    .map((entry) => ({
      id: entry.ref.id,
      type: entry.ref.type,
      mime: entry.ref.mime,
      size: entry.ref.size,
      eventSeq: entry.ref.eventSeq,
      status: entry.status,
      error: entry.error,
      data: summarizeArtifactPayload(entry),
    }));
}

function summarizeArtifactPayload(entry: DebugArtifactEntry): unknown {
  const payload = entry.payload;
  if (!payload) return undefined;
  if (entry.ref.mime.startsWith("image/")) {
    return {
      omitted: "image payload omitted",
      encoding: payload.encoding,
      hasContent: Boolean(payload.content),
    };
  }
  if (payload.data !== undefined) return compactValue(payload.data);
  if (payload.content) return sanitizeText(payload.content).slice(0, MAX_ARTIFACT_TEXT);
  return undefined;
}

function selectImportantEvents(events: DebugEvent[]): DebugEvent[] {
  const important = events.filter(
    (event) =>
      event.phase === "failed" ||
      event.status === "failed" ||
      event.kind === "diagnostic" ||
      event.detailRef ||
      event.screenshotRef,
  );
  const merged = [...important, ...events.slice(-40)];
  const seen = new Set<string>();
  return merged
    .filter((event) => {
      const key = `${event.sessionId}:${event.runId}:${event.seq}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.seq - b.seq)
    .slice(-MAX_EVENTS);
}

function compactValue(value: unknown, depth = 0): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value === "string") return sanitizeText(value).slice(0, MAX_ARTIFACT_TEXT);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => compactValue(item, depth + 1));
  }
  if (typeof value !== "object") return String(value);
  if (depth >= 3) return "[object omitted]";
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !/api[_-]?key|token|secret|password/i.test(key))
      .slice(0, 40)
      .map(([key, item]) => [key, compactValue(item, depth + 1)]),
  );
}

function sanitizeText(value: string): string {
  return value
    .replace(/([A-Za-z]:)?[\\/][^\s"'`，。；：]+/g, "[path]")
    .replace(/(api[_-]?key|token|secret|password)["'\s:=]+[^,\s"'}]+/gi, "$1=[redacted]");
}

function sanitizePath(value?: string): string | undefined {
  if (!value) return value;
  const parts = value.split(/[\\/]+/).filter(Boolean);
  return parts.slice(-3).join("/");
}

function stripCodeFence(value: string): string {
  const match = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() ?? value;
}

function normalizeReportText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSimpleSummary(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 180) : "";
}

function firstMeaningfulLine(value: string): string {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.replace(/^#+\s*/, "").trim())
      .find((line) => line.length > 0)
      ?.slice(0, 180) ?? ""
  );
}
