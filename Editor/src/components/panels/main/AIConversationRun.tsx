import { memo, useEffect, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { Avatar, Tag } from "antd";
import {
  Bubble,
  Think,
  ThoughtChain,
  type BubbleItemType,
  type ThoughtChainItemType,
} from "@ant-design/x";
import {
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type {
  BusinessArchitectureDocument,
  HarnessRun,
  HarnessRunStatus,
  RunEvent,
} from "@/features/ai-harness";
import { useBusinessArchitectureStore } from "@/features/ai-harness";
import { BusinessArchitectureArtifact } from "@/features/ai-harness/capabilities/business-architecture/BusinessArchitectureArtifact";
import style from "../../../styles/panels/AIHistoryPanel.module.less";
import { renderMarkdown } from "./AIConversationMarkdown";

const statusLabels: Record<HarnessRunStatus, string> = {
  queued: "排队中",
  running: "运行中",
  waiting_tool: "执行工具",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已停止",
  partial: "部分完成",
};

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
    avatar: (
      <Avatar
        shape="square"
        size={28}
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt="MPE Harness"
      />
    ),
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
  reasoning: {
    placement: "start",
    variant: "borderless",
    classNames: { content: style.reasoningBubbleContent },
  },
  artifact: {
    placement: "start",
    avatar: (
      <Avatar
        shape="square"
        size={28}
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt="MPE Harness"
      />
    ),
    variant: "borderless",
    classNames: { content: style.artifactBubbleContent },
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

function createMessageHeader(
  role: "你" | "MPE Harness",
  timestamp?: number,
): ReactNode {
  return (
    <span className={style.messageHeader}>
      <span>{role}</span>
      {timestamp && <time>{formatAIConversationTime(timestamp)}</time>}
    </span>
  );
}

function createReasoningContent(
  text: string,
  active = false,
  thinking = false,
): ReactNode {
  return (
    <ReasoningThink text={text} active={active} thinking={thinking} />
  );
}

function ReasoningThink({
  text,
  active,
  thinking,
}: {
  text: string;
  active: boolean;
  thinking: boolean;
}) {
  const [expanded, setExpanded] = useState(thinking);

  useEffect(() => {
    if (active) setExpanded(thinking);
  }, [active, thinking]);

  return (
    <Think
      title={thinking ? "思考中" : "已思考"}
      loading={thinking}
      blink={thinking}
      expanded={expanded}
      onExpand={setExpanded}
      rootClassName={style.reasoningThink}
      data-streaming-expanded={active ? String(expanded) : undefined}
    >
      {expanded ? renderMarkdown({ text, streaming: thinking }) : null}
    </Think>
  );
}

function createBubbleItems(
  run: HarnessRun,
  events: RunEvent[],
  streamingText: string,
  streamingReasoning: string,
  architectureDocument: BusinessArchitectureDocument | undefined,
  openArchitectureDocument: () => void,
): BubbleItemType[] {
  const items: BubbleItemType[] = [];
  const toolResults = new Map(
    events
      .filter((event) => event.type === "tool_result")
      .map((event) => [event.toolCallId, event]),
  );
  let toolSegment: ToolProjection[] = [];
  const isActive = ["queued", "running", "waiting_tool"].includes(run.status);

  const flushToolSegment = () => {
    if (toolSegment.length === 0) return;
    const firstRequest = toolSegment[0].requested;
    items.push({
      key: `${run.id}-tools-${firstRequest.id}`,
      role: "tools",
      content: createToolChain(toolSegment, run.status),
      header: "工具调用",
    });
    toolSegment = [];
  };

  events.forEach((event) => {
    if (event.type === "tool_requested") {
      toolSegment.push({
        requested: event,
        result: toolResults.get(event.toolCallId),
      });
      return;
    }
    if (event.type === "user_message") {
      flushToolSegment();
      items.push({
        key: event.id,
        role: "user",
        content: { text: event.text ?? "" },
        header: createMessageHeader("你", event.timestamp),
        status: "local",
      });
      return;
    }
    if (event.type === "assistant_message") {
      flushToolSegment();
      items.push({
        key: event.id,
        role: "assistant",
        content: { text: event.text ?? "" },
        header: createMessageHeader("MPE Harness", event.timestamp),
        status: "success",
      });
      return;
    }
    if (event.type === "assistant_reasoning" && event.text) {
      flushToolSegment();
      items.push({
        key: event.id,
        role: "reasoning",
        content: createReasoningContent(event.text),
        status: "success",
      });
    }
  });
  flushToolSegment();

  if (run.status === "succeeded" && architectureDocument) {
    items.push({
      key: `${run.id}-business-architecture`,
      role: "artifact",
      content: (
        <BusinessArchitectureArtifact
          document={architectureDocument}
          onOpen={openArchitectureDocument}
        />
      ),
      header: createMessageHeader("MPE Harness", run.finishedAt),
      status: "success",
    });
  }

  if (isActive) {
    if (streamingReasoning) {
      items.push({
        key: `${run.id}-streaming-reasoning`,
        role: "reasoning",
        content: createReasoningContent(
          streamingReasoning,
          true,
          !streamingText,
        ),
        status: "updating",
      });
    }
    if (!streamingReasoning || streamingText) {
      items.push({
        key: `${run.id}-streaming`,
        role: "assistant",
        content: { text: streamingText, streaming: true },
        header: createMessageHeader("MPE Harness"),
        loading: !streamingText,
        streaming: true,
        status: "updating",
      });
    }
  }
  return items;
}

export const AIConversationRun = memo(
  ({ run, events, streamingText, streamingReasoning }: {
    run: HarnessRun;
    events: RunEvent[];
    streamingText: string;
    streamingReasoning: string;
  }) => {
    const architectureDocument = useBusinessArchitectureStore(
      (state) => state.documents[run.id],
    );
    const openDocument = useBusinessArchitectureStore(
      (state) => state.openDocument,
    );
    return (
      <article className={style.run}>
      <div className={style.runMeta}>
        <Tag className={style.runStatus} color={runStatusColor(run.status)}>
          {statusLabels[run.status]}
        </Tag>
        <span>{run.profileSnapshot.name}</span>
        <span aria-hidden="true">·</span>
        <span>{run.turnCount} 轮</span>
        <span aria-hidden="true">·</span>
        <span>{run.toolCallCount} 次工具</span>
        <span aria-hidden="true">·</span>
        <span>{getRunDuration(run)}</span>
        <span aria-hidden="true">·</span>
        <span>{formatTokenCount(run.tokenUsage.totalTokens)} tokens</span>
      </div>
      <Bubble.List
        items={createBubbleItems(
          run,
          events,
          streamingText,
          streamingReasoning,
          architectureDocument,
          () => openDocument(run.id),
        )}
        role={bubbleRoles}
        autoScroll
        rootClassName={style.bubbleList}
      />
      {run.error && <div className={style.runError}>{run.error}</div>}
      </article>
    );
  },
);
