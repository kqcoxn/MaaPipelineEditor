import { useMemo, type CSSProperties, type ReactNode } from "react";
import { Alert, Button, Empty, List, Space, Tag, Typography } from "antd";
import {
  FileTextOutlined,
  NodeIndexOutlined,
  ProfileOutlined,
  ReloadOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { DebugSection } from "../DebugSection";
import type { DebugModalController } from "../../hooks/useDebugModalController";
import {
  countDebugDiagnosticsBySeverity,
  collectSpecificLoadingReasons,
  debugResourceHealthCategories,
  getDebugDiagnosticSuggestion,
  getDebugResourceHealthCategory,
  getDebugResourceHealthCategoryLabel,
  sortDebugResourceHealthDiagnostics,
} from "../../resourceHealth";
import type { DebugDiagnostic, DebugResourceHealthCategory } from "../../types";

const { Text } = Typography;
const emptyDiagnostics: DebugDiagnostic[] = [];

const metaListStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const metaValueStyle: CSSProperties = {
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

export function ResourceHealthPanel({
  controller,
}: {
  controller: DebugModalController;
}) {
  const graphFileCount =
    controller.resourceHealthRequest?.graphSnapshot.files.length ?? 0;
  const diagnostics =
    controller.resourceHealthResult?.diagnostics ?? emptyDiagnostics;
  const loadingReasonCount = collectSpecificLoadingReasons(diagnostics).length;
  const groupedDiagnostics = useMemo(
    () =>
      debugResourceHealthCategories.map((category) => ({
        category,
        diagnostics: sortDebugResourceHealthDiagnostics(
          category,
          diagnostics.filter(
            (diagnostic) =>
              getDebugResourceHealthCategory(diagnostic) === category,
          ),
        ),
      })),
    [diagnostics],
  );
  const severityCounts = countDebugDiagnosticsBySeverity(diagnostics);
  const alertType = resolveAlertType(
    controller.resourceHealthStatus,
    severityCounts,
  );
  const alertMessage = resolveAlertMessage(
    controller.resourceHealthStatus,
    severityCounts,
    Boolean(controller.connected),
  );
  const alertDescription = resolveAlertDescription(controller, severityCounts);

  return (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <Alert
        type={alertType}
        showIcon
        message={alertMessage}
        description={alertDescription}
      />
      <Space wrap>
        <Button
          icon={<ReloadOutlined />}
          loading={controller.resourceHealthStatus === "checking"}
          onClick={controller.requestResourceHealth}
        >
          重新体检
        </Button>
        <Button
          icon={<SettingOutlined />}
          onClick={() => controller.handlePanelClick("setup")}
        >
          打开调试配置
        </Button>
        <Button
          icon={<ProfileOutlined />}
          onClick={() => controller.handlePanelClick("overview")}
        >
          打开中控台
        </Button>
      </Space>
      <div style={metaListStyle}>
        <Tag>
          资源路径 {controller.resourceHealthRequest?.resourcePaths.length ?? 0}
        </Tag>
        <Tag>MPE已加载文件 {graphFileCount}</Tag>
        <Tag>
          节点映射{" "}
          {controller.resourceHealthRequest?.resolverSnapshot.nodes.length ?? 0}
        </Tag>
        <Tag>
          连线映射{" "}
          {controller.resourceHealthRequest?.resolverSnapshot.edges.length ?? 0}
        </Tag>
        {loadingReasonCount > 0 && <Tag>加载失败线索 {loadingReasonCount}</Tag>}
        {controller.resourceHealthResult?.durationMs !== undefined && (
          <Tag>耗时 {controller.resourceHealthResult.durationMs}ms</Tag>
        )}
      </div>
      {controller.resourceHealthDraftError && (
        <Alert
          type="error"
          showIcon
          message="资源体检请求生成失败"
          description={controller.resourceHealthDraftError}
        />
      )}
      {groupedDiagnostics.map((group) => (
        <ResourceHealthSection
          key={group.category}
          category={group.category}
          diagnostics={group.diagnostics}
          controller={controller}
        />
      ))}
    </Space>
  );
}

function ResourceHealthSection({
  category,
  diagnostics,
  controller,
}: {
  category: DebugResourceHealthCategory;
  diagnostics: DebugDiagnostic[];
  controller: DebugModalController;
}) {
  const blockingCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  const warningCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "warning",
  ).length;

  return (
    <DebugSection
      title={`${getDebugResourceHealthCategoryLabel(category)}${
        diagnostics.length > 0
          ? ` · ${blockingCount} 错误 / ${warningCount} 警告`
          : ""
      }`}
    >
      {diagnostics.length === 0 ? (
        <Empty
          description="当前分组暂无结果"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          bordered
          dataSource={diagnostics}
          renderItem={(diagnostic) => {
            const suggestion = getDebugDiagnosticSuggestion(diagnostic);
            const actions = [];
            if (diagnostic.fileId || diagnostic.sourcePath) {
              actions.push(
                <Button
                  key="file"
                  size="small"
                  icon={<FileTextOutlined />}
                  onClick={() =>
                    controller.focusFile(
                      diagnostic.fileId,
                      diagnostic.sourcePath,
                    )
                  }
                >
                  打开文件
                </Button>,
              );
            }
            if (diagnostic.nodeId) {
              actions.push(
                <Button
                  key="focus"
                  size="small"
                  icon={<NodeIndexOutlined />}
                  onClick={() => controller.focusNode(diagnostic.nodeId!)}
                >
                  定位节点
                </Button>,
              );
            }
            return (
              <List.Item actions={actions.length > 0 ? actions : undefined}>
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <Tag color={severityColor(diagnostic.severity)}>
                        {diagnostic.severity}
                      </Tag>
                      <Text>{diagnostic.message}</Text>
                    </Space>
                  }
                  description={
                    <Space
                      direction="vertical"
                      size={6}
                      style={{ width: "100%" }}
                    >
                      <Text type="secondary">{diagnostic.code}</Text>
                      {(diagnostic.sourcePath ||
                        diagnostic.fileId ||
                        diagnostic.nodeId) && (
                        <Space direction="vertical" size={2}>
                          {diagnostic.sourcePath && (
                            <Text style={metaValueStyle}>
                              路径: {diagnostic.sourcePath}
                            </Text>
                          )}
                          {diagnostic.fileId && (
                            <Text style={metaValueStyle}>
                              fileId: {diagnostic.fileId}
                            </Text>
                          )}
                          {diagnostic.nodeId && (
                            <Text style={metaValueStyle}>
                              nodeId: {diagnostic.nodeId}
                            </Text>
                          )}
                        </Space>
                      )}
                      {suggestion && (
                        <Text type="secondary">修复建议: {suggestion}</Text>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </DebugSection>
  );
}

function resolveAlertType(
  status: DebugModalController["resourceHealthStatus"],
  counts: Record<DebugDiagnostic["severity"], number>,
): "success" | "info" | "warning" | "error" {
  if (status === "checking") return "info";
  if (status === "error") return "error";
  if (counts.warning > 0) return "warning";
  if (status === "ready") return "success";
  return "info";
}

function resolveAlertMessage(
  status: DebugModalController["resourceHealthStatus"],
  counts: Record<DebugDiagnostic["severity"], number>,
  connected: boolean,
): string {
  if (!connected) return "LocalBridge 未连接";
  if (status === "checking") return "正在执行资源体检";
  if (status === "error") return "资源体检发现阻塞问题";
  if (status === "ready" && counts.warning > 0) {
    return "资源体检通过，但仍有提醒";
  }
  if (status === "ready") return "资源体检通过";
  return "资源体检待执行";
}

function resolveAlertDescription(
  controller: DebugModalController,
  counts: Record<DebugDiagnostic["severity"], number>,
): ReactNode {
  const diagnostics =
    controller.resourceHealthResult?.diagnostics ?? emptyDiagnostics;
  const loadFailed = diagnostics.some(
    (diagnostic) => diagnostic.code === "debug.resource.load_failed",
  );
  const loadBlockedBeforeExecution = diagnostics.some(
    (diagnostic) =>
      diagnostic.code === "debug.resource.load_skipped" ||
      diagnostic.code === "debug.resource.load_unavailable",
  );
  if (!controller.connected) {
    return "资源体检需要 LocalBridge 连接后才能执行。";
  }
  if (controller.resourceHealthStatus === "checking") {
    return "正在检查资源路径和资源加载情况。";
  }
  if (controller.resourceHealthError && diagnostics.length === 0) {
    return controller.resourceHealthError;
  }
  if (controller.resourceHealthStatus === "error") {
    if (loadFailed) {
      const failureReasons = collectSpecificLoadingReasons(diagnostics);
      if (failureReasons.length > 0) {
        return (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {failureReasons.map((reason, index) => (
              <li key={`${reason.code}-${index}`}>
                <Text>{reason.message}</Text>
              </li>
            ))}
          </ul>
        );
      }
      return "请优先查看下方“资源加载”分组中的错误项。";
    }
    if (loadBlockedBeforeExecution) {
      return "请先修复资源路径解析或运行环境问题，再重新体检。";
    }
    return `本次体检共返回 ${counts.error} 个错误、${counts.warning} 个警告、${counts.info} 个提示。`;
  }
  if (controller.resourceHealthStatus === "ready") {
    return `本次体检共返回 ${counts.error} 个错误、${counts.warning} 个警告、${counts.info} 个提示。`;
  }
  return "打开此页后会自动针对当前调试上下文做一次体检；也可以手动重新触发。";
}

function severityColor(severity: DebugDiagnostic["severity"]): string {
  switch (severity) {
    case "error":
      return "red";
    case "warning":
      return "gold";
    default:
      return "blue";
  }
}
