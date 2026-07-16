import { message } from "antd";
import type { DebugProtocolClient } from "../../services/protocols/DebugProtocolClient";
import { useDebugTraceStore } from "../../stores/debugTraceStore";
import type { DebugNodeExecutionRecord } from "./nodeExecutionSelector";
import type { DebugEvent, DebugTraceReplayStatus } from "./types";

interface TraceReplayActionContext {
  client: DebugProtocolClient;
  replayStatus?: DebugTraceReplayStatus;
  sessionId?: string;
  summaryRunId?: string;
}

export function requestTraceSnapshotAction({
  activeRunId,
  client,
  sessionId,
}: {
  activeRunId?: string;
  client: DebugProtocolClient;
  sessionId?: string;
}): void {
  if (!sessionId) {
    message.warning("当前没有调试会话（Session）");
    return;
  }
  const sent = client.requestTraceSnapshot({
    sessionId,
    runId: activeRunId,
  });
  if (!sent) message.error("发送追踪快照（Trace Snapshot）请求失败");
}

export function startTraceReplayAction({
  client,
  events,
  replayStatus,
  selectedNodeId,
  sessionId,
  summaryRunId,
}: TraceReplayActionContext & {
  events: DebugEvent[];
  selectedNodeId?: string;
}): void {
  if (!sessionId) {
    message.warning("当前没有调试会话（Session）");
    return;
  }
  const replayEvents = summaryRunId
    ? events.filter((event) => event.runId === summaryRunId)
    : events;
  const sent = client.startTraceReplay({
    sessionId,
    runId: summaryRunId,
    cursorSeq: replayStatus?.cursorSeq || replayEvents[0]?.seq,
    nodeId: selectedNodeId,
    speed: replayStatus?.speed ?? 1,
  });
  if (!sent) message.error("发送追踪回放（Trace Replay）启动请求失败");
}

export function seekTraceReplayAction({
  client,
  cursorSeq,
  replayStatus,
  sessionId,
  summaryRunId,
}: TraceReplayActionContext & { cursorSeq?: number }): void {
  if (!sessionId) {
    message.warning("当前没有调试会话（Session）");
    return;
  }
  const sent = client.seekTraceReplay({
    sessionId,
    runId: summaryRunId,
    cursorSeq,
    nodeId: replayStatus?.nodeId,
    speed: replayStatus?.speed ?? 1,
  });
  if (!sent) message.error("发送追踪回放定位（Trace Replay Seek）请求失败");
}

export function stopTraceReplayAction({
  client,
  sessionId,
}: TraceReplayActionContext): void {
  if (!sessionId) {
    useDebugTraceStore.getState().stopTraceReplay();
    return;
  }
  const sent = client.stopTraceReplay({
    sessionId,
    reason: "user_stop",
  });
  if (!sent) {
    useDebugTraceStore.getState().stopTraceReplay();
    message.error("发送追踪回放（Trace Replay）停止请求失败");
  }
}

export function startNodeTraceReplayAction({
  client,
  record,
  replayStatus,
  sessionId,
}: {
  client: DebugProtocolClient;
  record?: DebugNodeExecutionRecord;
  replayStatus?: DebugTraceReplayStatus;
  sessionId?: string;
}): void {
  if (!record) {
    message.warning("请选择节点执行记录");
    return;
  }
  const targetSessionId = record.sessionId ?? sessionId;
  if (!targetSessionId) {
    message.warning("当前没有调试会话（Session）");
    return;
  }
  const sent = client.startTraceReplay({
    sessionId: targetSessionId,
    runId: record.runId,
    cursorSeq: record.firstSeq,
    nodeId: record.nodeId,
    speed: replayStatus?.speed ?? 1,
  });
  if (!sent) message.error("发送节点回放启动请求失败");
}

export function seekNodeTraceReplayAction({
  client,
  cursorSeq,
  record,
  replayStatus,
  sessionId,
}: {
  client: DebugProtocolClient;
  cursorSeq?: number;
  record?: DebugNodeExecutionRecord;
  replayStatus?: DebugTraceReplayStatus;
  sessionId?: string;
}): void {
  if (!record) {
    message.warning("请选择节点执行记录");
    return;
  }
  const targetSessionId = record.sessionId ?? sessionId;
  if (!targetSessionId) {
    message.warning("当前没有调试会话（Session）");
    return;
  }
  const sent = client.seekTraceReplay({
    sessionId: targetSessionId,
    runId: record.runId,
    cursorSeq: cursorSeq ?? record.firstSeq,
    nodeId: record.nodeId,
    speed: replayStatus?.speed ?? 1,
  });
  if (!sent) message.error("发送节点回放定位请求失败");
}
