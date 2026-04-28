import { Alert, Button, Space, Tag, Typography } from "antd";
import {
  CaretRightOutlined,
  FileSearchOutlined,
  PictureOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { DebugSection } from "../DebugSection";
import type { DebugModalController } from "../../hooks/useDebugModalController";
import {
  getAgentTransportLabel,
  getArtifactCapabilityLabel,
  getControllerLabel,
  getDebugFeatureLabel,
  getDebugStatusLabel,
  getDiagnosticCapabilityLabel,
  getProfileFeatureLabel,
  getResourceApiLabel,
  getRunModeLabel,
  getScreenshotSourceLabel,
  getTaskerApiLabel,
  getUnavailableReasonLabel,
} from "../../capabilityLabels";

const { Text } = Typography;

export function OverviewPanel({
  controller,
}: {
  controller: DebugModalController;
}) {
  const {
    capabilityStatus,
    capabilityError,
    lastError,
    capabilities,
    debugReadiness,
    availableModeIds,
    selectedNodeId,
    session,
    activeRun,
    summary,
    lastRunMode,
    events,
    liveSummary,
    replayStatus,
    performanceSummary,
    startRun,
    confirmActionRun,
    stopRun,
  } = controller;

  return (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      {capabilityStatus === "error" && (
        <Alert
          type="error"
          showIcon
          message="调试能力读取失败"
          description={capabilityError}
        />
      )}
      {lastError && (
        <Alert
          type="error"
          showIcon
          message={lastError.code}
          description={lastError.message}
        />
      )}
      <DebugSection title="运行控制">
        <Space wrap>
          <Button
            type="primary"
            icon={<CaretRightOutlined />}
            onClick={() => startRun("full-run")}
            disabled={!debugReadiness.ready || !availableModeIds.has("full-run")}
          >
            完整运行
          </Button>
          <Button
            icon={<CaretRightOutlined />}
            onClick={() => startRun("run-from-node", selectedNodeId)}
            disabled={
              !debugReadiness.ready ||
              !selectedNodeId ||
              !availableModeIds.has("run-from-node")
            }
          >
            从选中节点运行
          </Button>
          <Button
            icon={<CaretRightOutlined />}
            onClick={() => startRun("single-node-run", selectedNodeId)}
            disabled={
              !debugReadiness.ready ||
              !selectedNodeId ||
              !availableModeIds.has("single-node-run")
            }
          >
            单节点运行
          </Button>
          <Button
            icon={<FileSearchOutlined />}
            onClick={() => startRun("recognition-only", selectedNodeId)}
            disabled={
              !debugReadiness.ready ||
              !selectedNodeId ||
              !availableModeIds.has("recognition-only")
            }
          >
            仅识别
          </Button>
          <Button
            danger
            icon={<CaretRightOutlined />}
            onClick={() => confirmActionRun(selectedNodeId)}
            disabled={
              !debugReadiness.ready ||
              !selectedNodeId ||
              !availableModeIds.has("action-only")
            }
          >
            仅动作
          </Button>
          <Button
            icon={<PictureOutlined />}
            onClick={() => startRun("fixed-image-recognition", selectedNodeId)}
            disabled={
              !debugReadiness.ready ||
              !selectedNodeId ||
              !availableModeIds.has("fixed-image-recognition")
            }
          >
            固定图识别
          </Button>
          <Button danger icon={<StopOutlined />} onClick={stopRun}>
            停止
          </Button>
        </Space>
      </DebugSection>
      <DebugSection title="会话（Session）">
        <Space wrap>
          <Tag color={session ? "green" : "default"}>
            {session?.sessionId ?? "未创建会话"}
          </Tag>
          <Tag>{session?.status ?? summary.status}</Tag>
          <Tag>运行 {activeRun?.runId ?? summary.runId ?? "-"}</Tag>
          <Tag>模式 {summary.runMode ?? lastRunMode}</Tag>
        </Space>
      </DebugSection>
      <DebugSection title="当前可用能力">
        {capabilities ? (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Space wrap>
              <Tag color="green">调试协议 {capabilities.protocol}</Tag>
              <Tag>{getDebugStatusLabel(capabilityStatus)}</Tag>
              <Tag>MaaFramework {capabilities.maa.mfwVersion}</Tag>
            </Space>
            <Space wrap>
              <Text type="secondary">运行方式</Text>
              {capabilities.runModes.map((mode) => (
                <Tag key={mode} color="blue">
                  {getRunModeLabel(mode)}
                </Tag>
              ))}
            </Space>
            {(capabilities.debugFeatures ?? []).length > 0 && (
              <Space wrap>
                <Text type="secondary">调试工具</Text>
                {(capabilities.debugFeatures ?? []).map((feature) => (
                  <Tag key={feature} color="purple">
                    {getDebugFeatureLabel(feature)}
                  </Tag>
                ))}
              </Space>
            )}
            <Space wrap>
              <Text type="secondary">启动检查</Text>
              {capabilities.diagnostics.map((diagnostic) => (
                <Tag key={diagnostic}>
                  {getDiagnosticCapabilityLabel(diagnostic)}
                </Tag>
              ))}
            </Space>
            <Space wrap>
              <Text type="secondary">可查看产物</Text>
              {capabilities.artifacts.map((artifact) => (
                <Tag key={artifact}>{getArtifactCapabilityLabel(artifact)}</Tag>
              ))}
            </Space>
            <Space wrap>
              <Text type="secondary">截图来源</Text>
              {capabilities.screenshotSources.map((source) => (
                <Tag key={source}>{getScreenshotSourceLabel(source)}</Tag>
              ))}
            </Space>
            <Space wrap>
              <Text type="secondary">配置能力</Text>
              {capabilities.profileFeatures.map((feature) => (
                <Tag key={feature}>{getProfileFeatureLabel(feature)}</Tag>
              ))}
            </Space>
            <Space wrap>
              <Text type="secondary">控制器</Text>
              {capabilities.maa.supportedControllers.map((controllerType) => (
                <Tag key={controllerType} color="green">
                  {getControllerLabel(controllerType)}
                </Tag>
              ))}
              {(capabilities.maa.unavailableControllers ?? []).map((item) => (
                <Tag key={item.type} color="orange">
                  {getControllerLabel(item.type)}不可用：{" "}
                  {getUnavailableReasonLabel(item.reason)}
                </Tag>
              ))}
            </Space>
            <Space wrap>
              <Text type="secondary">后端调用</Text>
              {capabilities.maa.supportedTaskerApis.map((api) => (
                <Tag key={api}>{getTaskerApiLabel(api)}</Tag>
              ))}
              {capabilities.maa.supportedResourceApis.map((api) => (
                <Tag key={api}>{getResourceApiLabel(api)}</Tag>
              ))}
              {capabilities.maa.supportedAgentTransports.map((transport) => (
                <Tag key={transport}>{getAgentTransportLabel(transport)}</Tag>
              ))}
            </Space>
          </Space>
        ) : (
          <Space wrap>
            <Tag>{getDebugStatusLabel(capabilityStatus)}</Tag>
            <Text type="secondary">连接 LocalBridge 后读取可用调试能力。</Text>
          </Space>
        )}
      </DebugSection>
      <DebugSection title="当前追踪（Trace）">
        <Space wrap>
          <Tag>事件 {events.length}</Tag>
          <Tag>实时事件 {liveSummary.lastEvent?.seq ?? 0}</Tag>
          <Tag>当前节点 {summary.currentRuntimeName ?? "-"}</Tag>
          <Tag color={replayStatus?.active ? "purple" : "default"}>
            {replayStatus?.active
              ? `回放 #${replayStatus.cursorSeq}`
              : "实时"}
          </Tag>
          <Tag color="green">已访问 {summary.visitedNodeIds.length}</Tag>
          <Tag color="red">失败 {summary.failedNodeIds.length}</Tag>
        </Space>
      </DebugSection>
      {performanceSummary && (
        <DebugSection title="性能摘要（Performance）">
          <Space wrap>
            <Tag>耗时 {performanceSummary.durationMs ?? 0}ms</Tag>
            <Tag>节点 {performanceSummary.nodeCount}</Tag>
            <Tag>识别 {performanceSummary.recognitionCount}</Tag>
            <Tag>动作 {performanceSummary.actionCount}</Tag>
            <Tag>产物 {performanceSummary.artifactRefCount}</Tag>
          </Space>
        </DebugSection>
      )}
    </Space>
  );
}
