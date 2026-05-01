import { Button, Empty, List, Space, Tag } from "antd";
import { DebugSection } from "../DebugSection";
import type { DebugModalController } from "../../hooks/useDebugModalController";
import type { DebugEvent } from "../../types";
import { eventTitle, formatTime } from "../../modalUtils";
import {
  isDebugTaskerBootstrapNode,
  isDebugTaskerBootstrapParent,
  readDebugNextCandidateNames,
} from "../../syntheticNode";

export function TimelinePanel({
  controller,
}: {
  controller: DebugModalController;
}) {
  const {
    events,
    requestTraceSnapshot,
    selectedNodeId,
  } = controller;

  if (events.length === 0) {
    return <Empty description="暂无追踪事件（Trace Event）" />;
  }

  return (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <DebugSection title="追踪事件（Trace Events）">
        <Space wrap>
          <Button size="small" onClick={requestTraceSnapshot}>
            刷新快照（Snapshot）
          </Button>
          {selectedNodeId && <Tag>节点 {selectedNodeId}</Tag>}
        </Space>
      </DebugSection>
      <List
        size="small"
        dataSource={[...events].reverse()}
        renderItem={(event) => (
          <List.Item>
            <List.Item.Meta
              title={eventTitle(event)}
              description={<EventMeta event={event} />}
            />
          </List.Item>
        )}
      />
    </Space>
  );
}

function EventMeta({ event }: { event: DebugEvent }) {
  const nextCandidateNames = readDebugNextCandidateNames(event);
  const showBootstrapNext =
    event.kind === "next-list" &&
    isDebugTaskerBootstrapNode(event.node) &&
    nextCandidateNames.length > 0;
  const showBootstrapParent =
    event.kind === "recognition" && isDebugTaskerBootstrapParent(event);

  return (
    <Space wrap size={4}>
      <Tag>{formatTime(event.timestamp)}</Tag>
      <Tag color={event.source === "maafw" ? "blue" : "default"}>
        {event.source}
      </Tag>
      {event.maafwMessage && <Tag>{event.maafwMessage}</Tag>}
      {showBootstrapNext && (
        <Tag color="purple">
          入口候选 {nextCandidateNames.slice(0, 3).join(", ")}
          {nextCandidateNames.length > 3 ? "..." : ""}
        </Tag>
      )}
      {showBootstrapParent && <Tag color="purple">来源 (Tasker) NextList</Tag>}
      {event.detailRef && <Tag color="purple">详情</Tag>}
      {event.screenshotRef && <Tag color="cyan">图像</Tag>}
    </Space>
  );
}
