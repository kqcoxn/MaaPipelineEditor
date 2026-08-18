import { memo } from "react";
import type { ComponentProps, ReactNode } from "react";
import { Avatar, Tag } from "antd";
import {
  Bubble,
  ThoughtChain,
  type BubbleItemType,
  type ThoughtChainItemType,
} from "@ant-design/x";
import { XMarkdown } from "@ant-design/x-markdown";
import {
  MessageOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";
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

interface MarkdownBubbleContent {
  text: string;
  streaming?: boolean;
}

function renderMarkdown(content: MarkdownBubbleContent) {
  return (
    <XMarkdown
      content={content.text}
      rootClassName={style.markdown}
      openLinksInNewTab
      escapeRawHtml
      streaming={
        content.streaming
          ? { hasNextChunk: true, enableAnimation: true, tail: true }
          : undefined
      }
    />
  );
}

const bubbleRoles: ComponentProps<typeof Bubble.List>["role"] = {
  user: {
    placement: "end",
    avatar: <Avatar shape="square" size={22} icon={<UserOutlined />} />,
    contentRender: renderMarkdown,
    variant: "filled",
    classNames: { content: style.userBubbleContent },
  },
  assistant: {
    placement: "start",
    avatar: <Avatar shape="square" size={22} icon={<MessageOutlined />} />,
    contentRender: renderMarkdown,
    variant: "borderless",
    classNames: { content: style.assistantBubbleContent },
  },
  tools: {
    placement: "start",
    avatar: <Avatar shape="square" size={22} icon={<ToolOutlined />} />,
    variant: "borderless",
    classNames: { content: style.toolBubbleContent },
  },
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

function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return tokens.toLocaleString();
  return `${(tokens / 1000).toFixed(1).replace(/\.0$/, "")}k`;
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

function formatToolValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function ToolField({ label, children, error = false }: {
  label: string;
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div className={error ? style.toolError : undefined}>
      <span>{label}</span>
      <code>{children}</code>
    </div>
  );
}

function renderToolDetails(projection: ToolProjection): ReactNode {
  const result = projection.result?.result;
  return (
    <div className={style.toolDetails}>
      <ToolField label="参数">
        {projection.requested.argumentsSummary || "{}"}
      </ToolField>
      {result?.data !== undefined && (
        <ToolField label="结果">{formatToolValue(result.data)}</ToolField>
      )}
      {result?.changes?.length ? (
        <ToolField label="变更">{result.changes.join("；")}</ToolField>
      ) : null}
      {result?.validationErrors?.length ? (
        <ToolField label="校验" error>
          {result.validationErrors.join("；")}
        </ToolField>
      ) : null}
      {result?.error && (
        <ToolField label="错误" error>
          {result.error.message}
        </ToolField>
      )}
      {result && (
        <ToolField label="状态">
          v{result.stateVersion}{result.undoable ? " · 可撤销" : ""}
        </ToolField>
      )}
    </div>
  );
}

function getToolStatus(
  projection: ToolProjection,
  runStatus: HarnessRunStatus,
): ThoughtChainItemType["status"] {
  if (projection.result?.result) {
    return projection.result.result.ok ? "success" : "error";
  }
  if (runStatus === "cancelled") return "abort";
  if (runStatus === "failed") return "error";
  return "loading";
}

function createToolChain(
  projections: ToolProjection[],
  runStatus: HarnessRunStatus,
): ReactNode {
  const items: ThoughtChainItemType[] = projections.map((projection) => {
    const status = getToolStatus(projection, runStatus);
    return {
      key: projection.requested.id,
      title: projection.requested.toolName || "无效工具调用",
      status,
      blink: status === "loading",
      collapsible: true,
      content: renderToolDetails(projection),
    };
  });
  return <ThoughtChain items={items} rootClassName={style.toolChain} />;
}

function createMessageHeader(role: "你" | "AI", timestamp?: number): ReactNode {
  return (
    <span className={style.messageHeader}>
      <span>{role}</span>
      {timestamp && <time>{formatAIConversationTime(timestamp)}</time>}
    </span>
  );
}

function createBubbleItems(
  run: HarnessRun,
  events: RunEvent[],
  streamingText: string,
): BubbleItemType[] {
  const items: BubbleItemType[] = [];
  const userEvent = events.find((event) => event.type === "user_message");
  const assistantEvents = events.filter(
    (event) => event.type === "assistant_message",
  );
  const toolEvents = projectToolEvents(events);
  const isActive = ["queued", "running", "waiting_tool"].includes(run.status);

  if (userEvent) {
    items.push({
      key: userEvent.id,
      role: "user",
      content: { text: userEvent.text ?? "" },
      header: createMessageHeader("你", userEvent.timestamp),
      status: "local",
    });
  }
  if (toolEvents.length > 0) {
    items.push({
      key: `${run.id}-tools`,
      role: "tools",
      content: createToolChain(toolEvents, run.status),
      header: "工具调用",
    });
  }
  assistantEvents.forEach((event) => {
    items.push({
      key: event.id,
      role: "assistant",
      content: { text: event.text ?? "" },
      header: createMessageHeader("AI", event.timestamp),
      status: "success",
    });
  });
  if (isActive) {
    items.push({
      key: `${run.id}-streaming`,
      role: "assistant",
      content: { text: streamingText, streaming: true },
      header: createMessageHeader("AI"),
      loading: !streamingText,
      streaming: true,
      status: "updating",
    });
  }
  return items;
}

export const AIConversationRun = memo(
  ({ run, events, streamingText }: {
    run: HarnessRun;
    events: RunEvent[];
    streamingText: string;
  }) => (
    <article className={style.run}>
      <div className={style.runMeta}>
        <Tag className={style.runStatus} color={runStatusColor(run.status)}>
          {statusLabels[run.status]}
        </Tag>
        <span>{run.turnCount} 轮</span>
        <span aria-hidden="true">·</span>
        <span>{run.toolCallCount} 次工具</span>
        <span aria-hidden="true">·</span>
        <span>{getRunDuration(run)}</span>
        <span aria-hidden="true">·</span>
        <span>{formatTokenCount(run.tokenUsage.totalTokens)} tokens</span>
      </div>
      <Bubble.List
        items={createBubbleItems(run, events, streamingText)}
        role={bubbleRoles}
        autoScroll
        rootClassName={style.bubbleList}
      />
      {run.error && <div className={style.runError}>{run.error}</div>}
    </article>
  ),
);
