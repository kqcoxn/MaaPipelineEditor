import { Empty, List, Typography } from "antd";
import type { DebugModalController } from "../../hooks/useDebugModalController";
import type { DebugEventKind } from "../../types";

const { Text } = Typography;

export function LogsPanel({
  controller,
}: {
  controller: DebugModalController;
}) {
  const logEvents = controller.events.filter((event) =>
    (["log", "session", "task"] satisfies DebugEventKind[]).includes(
      event.kind,
    ),
  );

  return logEvents.length === 0 ? (
    <Empty description="暂无日志事件" />
  ) : (
    <List
      size="small"
      dataSource={[...logEvents].reverse()}
      renderItem={(event) => (
        <List.Item>
          <Text>
            #{event.seq} {event.maafwMessage ?? event.status ?? event.kind}
          </Text>
        </List.Item>
      )}
    />
  );
}
