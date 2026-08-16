import { memo } from "react";
import { Tag } from "antd";
import {
  MessageOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";
import classNames from "classnames";
import type {
  HarnessRun,
  HarnessRunStatus,
  RunEvent,
} from "@/features/ai-harness";
import style from "../../../styles/panels/AIHistoryPanel.module.less";

const statusLabels: Record<HarnessRunStatus, string> = {
  queued: "排队中",
  running: "运行中",
  waiting_tool: "执行工具",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已停止",
  partial: "部分完成",
};

export function formatAIConversationTime(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function getRunDuration(run: HarnessRun, now = Date.now()): string {
  const start = run.startedAt ?? run.createdAt;
  const end = run.finishedAt ?? now;
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function runStatusColor(status: HarnessRunStatus): string {
  if (status === "succeeded") return "success";
  if (status === "failed") return "error";
  if (status === "cancelled") return "default";
  if (status === "partial") return "warning";
  return "processing";
}

interface ToolProjection {
  requested: RunEvent;
  result?: RunEvent;
}

function projectToolEvents(events: RunEvent[]): ToolProjection[] {
  const results = new Map(
    events
      .filter((event) => event.type === "tool_result")
      .map((event) => [event.toolCallId, event]),
  );
  return events
    .filter((event) => event.type === "tool_requested")
    .map((requested) => ({
      requested,
      result: results.get(requested.toolCallId),
    }));
}

const ToolEventItem = memo(({ projection }: { projection: ToolProjection }) => {
  const result = projection.result?.result;
  return (
    <details className={style.toolEvent}>
      <summary>
        <ToolOutlined />
        <span className={style.toolName}>{projection.requested.toolName}</span>
        <Tag color={!result ? "processing" : result.ok ? "success" : "error"}>
          {!result ? "执行中" : result.ok ? "成功" : "失败"}
        </Tag>
      </summary>
      <div className={style.toolDetails}>
        <div>
          <span>参数</span>
          <code>{projection.requested.argumentsSummary || "{}"}</code>
        </div>
        {result?.changes?.length ? (
          <div>
            <span>变更</span>
            <code>{result.changes.join("；")}</code>
          </div>
        ) : null}
        {result?.error ? (
          <div className={style.toolError}>
            <span>错误</span>
            <code>{result.error.message}</code>
          </div>
        ) : null}
        {result ? (
          <div>
            <span>状态</span>
            <code>
              v{result.stateVersion}{result.undoable ? " · 可撤销" : ""}
            </code>
          </div>
        ) : null}
      </div>
    </details>
  );
});

export const AIConversationRun = memo(
  ({ run, events, streamingText }: {
    run: HarnessRun;
    events: RunEvent[];
    streamingText: string;
  }) => {
    const userEvent = events.find((event) => event.type === "user_message");
    const assistantEvents = events.filter(
      (event) => event.type === "assistant_message",
    );
    const toolEvents = projectToolEvents(events);
    const isActive = ["queued", "running", "waiting_tool"].includes(run.status);

    return (
      <article className={style.run}>
        <div className={style.runMeta}>
          <Tag color={runStatusColor(run.status)}>{statusLabels[run.status]}</Tag>
          <span>Turn {run.turnCount}</span>
          <span>{run.toolCallCount} 次工具</span>
          <span>{getRunDuration(run)}</span>
          <span>{run.tokenUsage.totalTokens.toLocaleString()} tokens</span>
        </div>
        {userEvent && (
          <div className={classNames(style.message, style.userMessage)}>
            <div className={style.messageRole}>
              <UserOutlined />
              <span>你</span>
              <time>{formatAIConversationTime(userEvent.timestamp)}</time>
            </div>
            <div className={style.messageText}>{userEvent.text}</div>
          </div>
        )}
        {toolEvents.map((projection) => (
          <ToolEventItem key={projection.requested.id} projection={projection} />
        ))}
        {assistantEvents.map((event) => (
          <div key={event.id} className={classNames(style.message, style.aiMessage)}>
            <div className={style.messageRole}>
              <MessageOutlined />
              <span>AI</span>
              <time>{formatAIConversationTime(event.timestamp)}</time>
            </div>
            <div className={style.messageText}>{event.text}</div>
          </div>
        ))}
        {isActive && streamingText && (
          <div className={classNames(style.message, style.aiMessage, style.streaming)}>
            <div className={style.messageRole}>
              <MessageOutlined />
              <span>AI</span>
            </div>
            <div className={style.messageText}>{streamingText}</div>
          </div>
        )}
        {run.error && <div className={style.runError}>{run.error}</div>}
      </article>
    );
  },
);
