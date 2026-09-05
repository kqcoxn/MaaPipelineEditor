import type { DebugEvent } from "../types";
import { formatDebugNodeDisplayName } from "../utils/syntheticNode";
import {
  emptyDebugActivity, eventTime, numberValue, record, stringValue,
  type ActivityFrame, type ActivityOperation, type DebugActivity,
} from "./debugActivityTypes";

function isFrameEvent(event: DebugEvent): boolean {
  return event.kind === "node" || event.maafwMessage?.startsWith("Node.RecognitionNode.") === true ||
    event.maafwMessage?.startsWith("Node.ActionNode.") === true;
}

function frameId(event: DebugEvent): string {
  const family = event.maafwMessage?.split(".").slice(0, -1).join(".") ?? event.kind;
  return `${event.taskId}:${family}:${event.data?.nodeId ?? event.node?.runtimeName}`;
}

function newFrame(event: DebugEvent): ActivityFrame {
  return {
    id: frameId(event), taskId: event.taskId,
    name: formatDebugNodeDisplayName(event.node) ?? "当前节点",
    startedAt: eventTime(event), operations: [],
    timeoutMs: numberValue(record(event.data?.runtime).timeout),
  };
}

// focus 只展示内联文本；文件、URL、国际化键和复杂模板交给完整工作台。
function focusText(event: DebugEvent): string | undefined {
  const focus = record(event.data?.focus);
  const template = event.maafwMessage ? focus[event.maafwMessage] : undefined;
  const text = stringValue(template) ?? stringValue(record(template).content);
  if (!text || text.startsWith("$") || /^(https?:|file:|[./\\])/.test(text)) return;
  if (/\.(md|txt|html)$/i.test(text)) return;
  const values: Record<string, unknown> = { name: event.node?.runtimeName, task_id: event.taskId };
  const rendered = text.replace(/\{(name|task_id)\}/g, (_, key: string) => String(values[key] ?? ""));
  return /\{[^}]+\}/.test(rendered) ? undefined : rendered.slice(0, 240);
}

function applySearch(frame: ActivityFrame, event: DebugEvent): void {
  const now = eventTime(event);
  if (event.phase === "starting") {
    const previous = frame.search;
    const continuing = previous && previous.endedAt === undefined;
    const runtime = record(event.data?.runtime);
    frame.search = {
      owner: frame.name,
      startedAt: continuing ? previous.startedAt : previous ? now : frame.startedAt,
      round: continuing ? previous.round + 1 : 1,
      roundStartedAt: now, roundStatus: "running", attempted: 0,
      timeoutMs: frame.timeoutMs ?? numberValue(runtime.timeout),
      candidates: (Array.isArray(event.data?.next) ? event.data.next : []).map((item) => {
        const next = record(item);
        return { name: stringValue(next.name) ?? "未知候选", anchor: next.anchor === true,
          jumpBack: next.jumpBack === true, status: "pending" };
      }),
    };
  } else if (frame.search) {
    frame.search.roundEndedAt = now;
    frame.search.roundStatus = event.phase === "succeeded" ? "hit" : "miss";
    if (event.phase === "succeeded") frame.search.endedAt = now;
  }
}

function applyOperation(frame: ActivityFrame, event: DebugEvent): boolean {
  if (event.kind !== "recognition" && event.kind !== "action") return false;
  const kind = event.kind;
  const id = `${kind}:${event.data?.[kind === "recognition" ? "recognitionId" : "actionId"] ?? event.data?.id ?? event.node?.runtimeName}`;
  const now = eventTime(event);
  if (event.phase === "starting") {
    if (frame.operations.some((operation) => operation.id === id)) return false;
    const runtime = record(event.data?.runtime);
    const operation: ActivityOperation = {
      id, kind, startedAt: now,
      name: formatDebugNodeDisplayName(event.node) ?? frame.name,
      type: stringValue(runtime[kind]),
      customName: stringValue(runtime[kind === "recognition" ? "customRecognition" : "customAction"]),
    };
    // Custom 内部的识别不是外层 next 的候选，不能把它算作一次列表扫描。
    const search = frame.search;
    if (kind === "recognition" && frame.operations.length === 0 && search?.roundStatus === "running") {
      const index = search.candidates.findIndex((candidate) => candidate.status === "pending" &&
        !candidate.anchor && candidate.name === event.node?.runtimeName);
      if (index >= 0) {
        operation.candidateIndex = index;
        search.candidates[index] = { ...search.candidates[index], status: "running", startedAt: now };
      }
      search.attempted++;
    }
    frame.operations.push(operation);
    return true;
  }
  const index = frame.operations.findIndex((operation) => operation.id === id);
  if (index < 0) return false;
  const [operation] = frame.operations.splice(index, 1);
  operation.endedAt = now;
  operation.status = event.phase;
  operation.type ??= stringValue(event.data?.algorithm);
  frame.lastOperation = operation;
  if (operation.candidateIndex !== undefined && frame.search) {
    const candidate = frame.search.candidates[operation.candidateIndex];
    frame.search.candidates[operation.candidateIndex] = {
      ...candidate, endedAt: now, status: event.phase === "succeeded" ? "hit" : "miss",
    };
  }
  return false;
}

/** 仅消费追加事件；投影与展示会话、历史回放游标无关。 */
function consume(activity: DebugActivity, event: DebugEvent): void {
  activity.latestAt = eventTime(event);
  if (event.kind === "session") {
    activity.status = event.status ?? event.phase;
    if (["completed", "failed", "stopped"].includes(activity.status ?? "")) {
      activity.terminalAt = activity.latestAt;
    }
    return;
  }
  if (activity.terminalAt !== undefined) return;
  if (isFrameEvent(event)) {
    const id = frameId(event);
    if (event.phase === "starting") activity.frames.push(newFrame(event));
    else {
      const index = activity.frames.findIndex((frame) => frame.id === id);
      if (index >= 0) activity.lastFrame = activity.frames.splice(index, 1)[0];
    }
    return;
  }
  if (!["next-list", "recognition", "action"].includes(event.kind)) return;
  let frame: ActivityFrame | undefined;
  for (let index = activity.frames.length - 1; index >= 0; index--) {
    if (activity.frames[index].taskId === event.taskId) {
      frame = activity.frames[index];
      break;
    }
  }
  if (!frame) {
    frame = newFrame(event);
    activity.frames.push(frame);
  }
  frame.focus = focusText(event) ?? frame.focus;
  if (event.kind === "next-list") {
    applySearch(frame, event);
    if (event.phase === "starting") activity.totalRounds++;
  } else if (applyOperation(frame, event)) {
    if (event.kind === "recognition") activity.recognitionCount++;
    else activity.actionCount++;
  }
}

export function createDebugActivityProjector(sessionId: string, runId: string) {
  let activity = emptyDebugActivity();
  let consumed = 0;
  let last: DebugEvent | undefined;
  let first: DebugEvent | undefined;
  return (events: DebugEvent[]): DebugActivity => {
    if (events.length < consumed || (consumed > 0 && (events[0] !== first || events[consumed - 1] !== last))) {
      activity = emptyDebugActivity();
      consumed = 0;
    }
    // 不暴露可变累加器，后续事件不能改变 React 之前一次渲染的快照。
    for (; consumed < events.length; consumed++) {
      const event = events[consumed];
      if (event.sessionId === sessionId && event.runId === runId) consume(activity, event);
    }
    last = events[consumed - 1];
    first = events[0];
    return structuredClone(activity);
  };
}
