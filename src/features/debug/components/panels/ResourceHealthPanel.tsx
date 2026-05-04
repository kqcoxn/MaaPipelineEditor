import { useMemo, type CSSProperties } from "react";
import {
  Alert,
  Button,
  Empty,
  List,
  Space,
  Tag,
  Typography,
} from "antd";
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
  debugResourceHealthCategories,
  getDebugDiagnosticSuggestion,
  getDebugResourceHealthCategory,
  getDebugResourceHealthCategoryLabel,
} from "../../resourceHealth";
import type {
  DebugDiagnostic,
  DebugResourceHealthCategory,
} from "../../types";

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
  const diagnostics =
    controller.resourceHealthResult?.diagnostics ?? emptyDiagnostics;
  const groupedDiagnostics = useMemo(
    () =>
      debugResourceHealthCategories.map((category) => ({
        category,
        diagnostics: diagnostics.filter(
          (diagnostic) => getDebugResourceHealthCategory(diagnostic) === category,
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
        <Tag>资源路径 {controller.resourceHealthRequest?.resourcePaths.length ?? 0}</Tag>
        <Tag>图文件 {controller.resourceHealthRequest?.graphSnapshot.files.length ?? 0}</Tag>
        <Tag>
          resolver 节点{" "}
          {controller.resourceHealthRequest?.resolverSnapshot.nodes.length ?? 0}
        </Tag>
        <Tag>
          resolver 边{" "}
          {controller.resourceHealthRequest?.resolverSnapshot.edges.length ?? 0}
        </Tag>
        <Tag>
          当前目标 {controller.resourceHealthRequest?.target?.runtimeName ?? "未解析"}
        </Tag>
        {controller.resourceHealthResult?.durationMs !== undefined && (
          <Tag>耗时 {controller.resourceHealthResult.durationMs}ms</Tag>
        )}
      </div>
      <Text type="secondary">
        体检会检查资源路径解析、MaaFW 真实加载和当前图静态调试合法性。修改资源路径、图结构或入口节点后，请重新体检。
      </Text>
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
        <Empty description="当前分组暂无结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
                    )}
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
              <List.Item
                actions={actions.length > 0 ? actions : undefined}
              >
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
): string {
  if (!controller.connected) {
    return "资源体检依赖 LocalBridge 执行 MaaFW 真实加载；连接后可重新体检。";
  }
  if (controller.resourceHealthStatus === "checking") {
    return "后端正在校验资源路径、尝试真实加载资源，并检查当前图的静态调试合法性。";
  }
  if (controller.resourceHealthError) {
    return controller.resourceHealthError;
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
