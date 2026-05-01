import { Button, Empty, Space, Tag } from "antd";
import { DebugSection } from "../DebugSection";
import { DebugArtifactPreview } from "../DebugArtifactPreview";
import type { DebugModalController } from "../../hooks/useDebugModalController";
import {
  findDebugRunFirstTimestamp,
  formatDebugRunDisplayName,
} from "../../runDisplayName";

export function PerformancePanel({
  controller,
}: {
  controller: DebugModalController;
}) {
  const {
    performanceSummary,
    selectedPerformanceSummaries,
    performanceRefs,
    batchSummaryRefs,
    requestArtifact,
    selectedArtifact,
    events,
  } = controller;
  const activePerformanceSummary =
    selectedPerformanceSummaries[0] ?? performanceSummary;
  const selectedArtifactIsPerformance =
    selectedArtifact &&
    (performanceRefs.includes(selectedArtifact.ref.id) ||
      batchSummaryRefs.includes(selectedArtifact.ref.id));

  return (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <DebugSection title="性能摘要">
        {activePerformanceSummary ? (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Space wrap>
              <Tag>
                运行{" "}
                {formatDebugRunDisplayName(
                  activePerformanceSummary.runId,
                  activePerformanceSummary.startedAt ??
                    findDebugRunFirstTimestamp(
                      activePerformanceSummary.runId,
                      events,
                    ),
                )}
              </Tag>
              <Tag>{activePerformanceSummary.status ?? "-"}</Tag>
              <Tag>耗时 {activePerformanceSummary.durationMs ?? 0}ms</Tag>
              <Tag>事件 {activePerformanceSummary.eventCount}</Tag>
              <Tag>节点 {activePerformanceSummary.nodeCount}</Tag>
              <Tag>识别 {activePerformanceSummary.recognitionCount}</Tag>
              <Tag>动作 {activePerformanceSummary.actionCount}</Tag>
              <Tag>截图 {activePerformanceSummary.screenshotRefCount}</Tag>
              {selectedPerformanceSummaries.length > 1 && (
                <Tag>已选摘要 {selectedPerformanceSummaries.length}</Tag>
              )}
            </Space>
          </Space>
        ) : (
          <Empty description="运行结束后会生成性能摘要产物" />
        )}
      </DebugSection>
      <DebugSection title="性能产物">
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
      {selectedArtifactIsPerformance && (
        <DebugSection title="已选产物 JSON（Artifact JSON）">
          <DebugArtifactPreview artifact={selectedArtifact} />
        </DebugSection>
      )}
    </Space>
  );
}
