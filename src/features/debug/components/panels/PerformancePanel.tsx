import { Button, Empty, List, Space, Tag, Typography } from "antd";
import { DebugSection } from "../DebugSection";
import type { DebugModalController } from "../../hooks/useDebugModalController";
import {
  findDebugRunFirstTimestamp,
  formatDebugRunDisplayName,
} from "../../runDisplayName";

const { Text } = Typography;

export function PerformancePanel({
  controller,
}: {
  controller: DebugModalController;
}) {
  const {
    performanceSummary,
    performanceRefs,
    batchSummaryRefs,
    requestArtifact,
    selectedArtifact,
    events,
  } = controller;

  return (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <DebugSection title="性能摘要（Performance Summary）">
        {performanceSummary ? (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Space wrap>
              <Tag>
                运行{" "}
                {formatDebugRunDisplayName(
                  performanceSummary.runId,
                  performanceSummary.startedAt ??
                    findDebugRunFirstTimestamp(performanceSummary.runId, events),
                )}
              </Tag>
              <Tag>{performanceSummary.status ?? "-"}</Tag>
              <Tag>耗时 {performanceSummary.durationMs ?? 0}ms</Tag>
              <Tag>事件 {performanceSummary.eventCount}</Tag>
              <Tag>节点 {performanceSummary.nodeCount}</Tag>
              <Tag>识别 {performanceSummary.recognitionCount}</Tag>
              <Tag>动作 {performanceSummary.actionCount}</Tag>
              <Tag>截图 {performanceSummary.screenshotRefCount}</Tag>
            </Space>
            <List
              size="small"
              dataSource={performanceSummary.slowNodes}
              locale={{ emptyText: "暂无慢节点" }}
              renderItem={(node) => (
                <List.Item>
                  <Space wrap>
                    <Text>{node.label || node.runtimeName}</Text>
                    <Tag>{node.durationMs ?? 0}ms</Tag>
                    <Tag>{node.status}</Tag>
                    <Tag>
                      seq {node.firstSeq}-{node.lastSeq}
                    </Tag>
                  </Space>
                </List.Item>
              )}
            />
          </Space>
        ) : (
          <Empty description="运行结束后会生成性能摘要产物（Performance Summary Artifact）" />
        )}
      </DebugSection>
      <DebugSection title="性能产物（Performance Artifacts）">
        <Space wrap>
          {performanceRefs.map((ref) => (
            <Button key={ref} size="small" onClick={() => requestArtifact(ref)}>
              性能 #{ref.slice(0, 8)}
            </Button>
          ))}
          {batchSummaryRefs.map((ref) => (
            <Button key={ref} size="small" onClick={() => requestArtifact(ref)}>
              批量 #{ref.slice(0, 8)}
            </Button>
          ))}
        </Space>
      </DebugSection>
      {selectedArtifact?.payload?.data && (
        <DebugSection title="已选产物 JSON（Artifact JSON）">
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            {JSON.stringify(selectedArtifact.payload.data, null, 2)}
          </pre>
        </DebugSection>
      )}
    </Space>
  );
}
