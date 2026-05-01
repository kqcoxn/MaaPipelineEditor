import { Button, Empty, InputNumber, List, Space, Tag } from "antd";
import { CaretRightOutlined } from "@ant-design/icons";
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
    startTraceReplay,
    replayStatus,
    summary,
    seekTraceReplay,
    stopTraceReplay,
    selectedNodeId,
  } = controller;

  if (events.length === 0) {
    return <Empty description="暂无追踪事件（Trace Event）" />;
  }

  const replayEvents = summary.runId
    ? events.filter((event) => event.runId === summary.runId)
    : events;
  const firstReplaySeq = replayEvents[0]?.seq ?? events[0]?.seq ?? 1;
  const lastReplaySeq =
    replayEvents[replayEvents.length - 1]?.seq ??
    events[events.length - 1]?.seq ??
    1;

  return (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <DebugSection title="展示会话回放（Session Trace Replay）">
        <Space wrap>
          <Button size="small" onClick={requestTraceSnapshot}>
            刷新快照（Snapshot）
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<CaretRightOutlined />}
            onClick={startTraceReplay}
          >
            回放
          </Button>
          <InputNumber
            size="small"
            min={replayStatus?.minSeq ?? firstReplaySeq}
            max={replayStatus?.maxSeq ?? lastReplaySeq}
            value={replayStatus?.cursorSeq ?? summary.lastEvent?.seq}
            addonBefore="seq"
            onChange={(value) => seekTraceReplay(value ?? undefined)}
          />
          <Button size="small" onClick={() => seekTraceReplay(firstReplaySeq)}>
            到开头
          </Button>
          <Button
            size="small"
            onClick={() => seekTraceReplay(summary.lastEvent?.seq)}
          >
            到当前
          </Button>
          <Button size="small" danger onClick={stopTraceReplay}>
            回到实时（Live）
          </Button>
          <Tag color={replayStatus?.active ? "purple" : "default"}>
            {replayStatus?.active ? "回放" : "实时"}
          </Tag>
          <Tag>
            范围 {replayStatus?.minSeq ?? "-"}-{replayStatus?.maxSeq ?? "-"}
          </Tag>
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
