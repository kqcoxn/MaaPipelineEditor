import { List } from "../../../../components/SimpleList";
import { Typography, Button, Space, Tag, Alert, Empty, Collapse } from "antd";
import { useMemo, type CSSProperties, type ReactNode } from "react";
import {
  FileTextOutlined,
  NodeIndexOutlined,
  ProfileOutlined,
  ReloadOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
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
} from "../../selectors/resourceHealth";
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

type CheckStatus = "success" | "error" | "warning" | "checking" | "pending";

interface HealthCheck {
  key: string;
  title: string;
  description: string;
  status: CheckStatus;
  diagnostics: DebugDiagnostic[];
}

export function ResourceHealthPanel({
  controller,
}: {
  controller: DebugModalController;
}) {
  const graphFileCount =
    controller.resourceHealthRequest?.graphSnapshot.files.length ?? 0;
  const graphNodeCount =
    controller.resourceHealthRequest?.resolverSnapshot.nodes.length ?? 0;
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
  const checks = buildHealthChecks(
    controller,
    diagnostics,
  );
  const primaryDiagnostic = diagnostics.find(
    (diagnostic) => diagnostic.severity === "error",
  ) ?? diagnostics.find((diagnostic) => diagnostic.severity === "warning");

  return (
    <Space orientation="vertical" size={14} style={{ width: "100%" }}>
      {controller.connected && (
        <Alert
          type={alertType}
          showIcon
          title={alertMessage}
          description={alertDescription}
        />
      )}
      {primaryDiagnostic && controller.resourceHealthStatus === "error" && (
        <Alert
          type="error"
          showIcon
          title={getDiagnosticTitle(primaryDiagnostic)}
          description={
            <Space orientation="vertical" size={4}>
              <Text>{primaryDiagnostic.message}</Text>
              <Text type="secondary">
                影响：当前检查未通过，暂时无法启动调试。
              </Text>
              {getDebugDiagnosticSuggestion(primaryDiagnostic) && (
                <Text type="secondary">
                  建议：{getDebugDiagnosticSuggestion(primaryDiagnostic)}
                </Text>
              )}
            </Space>
          }
        />
      )}
      <div>
        <Text strong>调试准备检查</Text>
        <div style={{ marginTop: 10 }}>
          <Space orientation="vertical" size={8} style={{ width: "100%" }}>
            {checks.map((check) => (
              <HealthCheckRow key={check.key} check={check} />
            ))}
          </Space>
        </div>
      </div>
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
          资源目录 {controller.resourceHealthRequest?.resourcePaths.length ?? 0}
        </Tag>
        <Tag>流程文件 {graphFileCount}</Tag>
        <Tag>流程节点 {graphNodeCount}</Tag>
        <Tag>流程连线{" "}
          {controller.resourceHealthRequest?.resolverSnapshot.edges.length ?? 0}
        </Tag>
        {loadingReasonCount > 0 && <Tag>需处理 {loadingReasonCount} 项</Tag>}
        {controller.resourceHealthResult?.durationMs !== undefined && (
          <Tag>耗时 {controller.resourceHealthResult.durationMs}ms</Tag>
        )}
      </div>
      {controller.resourceHealthDraftError && (
        <Alert
          type="error"
          showIcon
          title="资源体检请求生成失败"
          description={controller.resourceHealthDraftError}
        />
      )}
      <Collapse
        items={groupedDiagnostics
          .filter((group) => group.diagnostics.length > 0)
          .map((group) => ({
            key: group.category,
            label: `${getDebugResourceHealthCategoryLabel(group.category)} · ${group.diagnostics.length} 项`,
            children: (
              <ResourceHealthSection
                category={group.category}
                diagnostics={group.diagnostics}
                controller={controller}
              />
            ),
          }))}
      />
    </Space>
  );
}

function HealthCheckRow({ check }: { check: HealthCheck }) {
  const icon = {
    success: <CheckCircleOutlined />,
    error: <CloseCircleOutlined />,
    warning: <ExclamationCircleOutlined />,
    checking: <ClockCircleOutlined />,
    pending: <ClockCircleOutlined />,
  }[check.status];
  const color = {
    success: "#389e0d",
    error: "#cf1322",
    warning: "#d48806",
    checking: "#1677ff",
    pending: "rgba(0, 0, 0, 0.45)",
  }[check.status];
  const label = {
    success: "已通过",
    error: "需处理",
    warning: "有提醒",
    checking: "检查中",
    pending: "待检查",
  }[check.status];

  return (
    <div
      role="listitem"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 12px",
        border: "1px solid rgba(5, 5, 5, 0.08)",
        borderRadius: 6,
      }}
    >
      <span style={{ color, fontSize: 16, lineHeight: "22px" }}>{icon}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <Space size={8} wrap>
          <Text strong>{check.title}</Text>
          <Tag color={check.status === "pending" ? undefined : color}>
            {label}
          </Tag>
        </Space>
        <div>
          <Text type="secondary">{check.description}</Text>
        </div>
      </div>
    </div>
  );
}

function buildHealthChecks(
  controller: DebugModalController,
  diagnostics: DebugDiagnostic[],
): HealthCheck[] {
  const resolution = diagnostics.filter(
    (diagnostic) => getDebugResourceHealthCategory(diagnostic) === "resolution",
  );
  const loading = diagnostics.filter(
    (diagnostic) => getDebugResourceHealthCategory(diagnostic) === "loading",
  );
  const graph = diagnostics.filter(
    (diagnostic) =>
      getDebugResourceHealthCategory(diagnostic) === "graph" &&
      !diagnostic.code.startsWith("debug.resolver.") &&
      !diagnostic.code.startsWith("debug.target."),
  );
  const mapping = diagnostics.filter(
    (diagnostic) =>
      diagnostic.code.startsWith("debug.resolver.") ||
      diagnostic.code.startsWith("debug.target."),
  );

  return [
    {
      key: "resolution",
      title: "资源路径",
      description:
        resolution.length > 0
          ? `${resolution.filter((diagnostic) => diagnostic.severity === "error").length > 0 ? "存在路径问题" : "已找到资源目录"}。`
          : "尚未获得资源路径检查结果。",
      status: getCheckStatus(controller.resourceHealthStatus, resolution),
      diagnostics: resolution,
    },
    {
      key: "loading",
      title: "MaaFW 资源加载",
      description:
        loading.some((diagnostic) => diagnostic.severity === "error")
          ? "MaaFW 无法完成资源加载。"
          : loading.length > 0
            ? "MaaFW 已完成资源加载检查。"
            : "尚未执行 MaaFW 资源加载。",
      status: getCheckStatus(controller.resourceHealthStatus, loading),
      diagnostics: loading,
    },
    {
      key: "graph",
      title: "流程文件",
      description:
        graph.some((diagnostic) => diagnostic.severity === "error")
          ? "当前流程文件存在无法用于调试的问题。"
          : graph.length > 0
            ? "当前流程文件结构可供检查。"
            : "尚未获得流程文件检查结果。",
      status: getCheckStatus(controller.resourceHealthStatus, graph),
      diagnostics: graph,
    },
    {
      key: "mapping",
      title: "节点映射",
      description:
        mapping.some((diagnostic) => diagnostic.severity === "error")
          ? "部分编辑器节点无法对应到 MaaFW 运行节点。"
          : mapping.length > 0
            ? "编辑器节点与运行时映射已检查。"
            : "尚未获得节点映射检查结果。",
      status: getCheckStatus(controller.resourceHealthStatus, mapping),
      diagnostics: mapping,
    },
  ];
}

function getCheckStatus(
  status: DebugModalController["resourceHealthStatus"],
  diagnostics: DebugDiagnostic[],
): CheckStatus {
  if (status === "checking") return "checking";
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return "error";
  }
  if (diagnostics.some((diagnostic) => diagnostic.severity === "warning")) {
    return "warning";
  }
  if (status === "ready") return "success";
  return "pending";
}

function getDiagnosticTitle(diagnostic: DebugDiagnostic): string {
  const titles: Record<string, string> = {
    "debug.resource.load_failed": "资源包加载失败",
    "debug.resource.load_skipped": "资源包尚未加载",
    "debug.resource.load_unavailable": "MaaFW 尚未初始化",
    "debug.resource.pipeline_json_invalid": "Pipeline 文件格式错误",
    "debug.resource.pipeline_node_name_duplicate": "Pipeline 节点名称重复",
    "debug.graph.empty": "当前没有可检查的流程",
    "debug.resolver.runtime_duplicate": "运行时节点名称重复",
    "debug.resolver.edge_target_unknown": "流程连线指向不存在的节点",
    "debug.target.not_in_resolver": "调试目标无法映射到运行节点",
  };
  return titles[diagnostic.code] ?? diagnostic.message;
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
          style={{ padding: "12px 16px" }}
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
              <List.Item>
                {(List.Item as any).Meta({
                  title: (
                    <Space wrap>
                      <Tag color={severityColor(diagnostic.severity)}>
                        {severityLabel(diagnostic.severity)}
                      </Tag>
                      <Text strong>{getDiagnosticTitle(diagnostic)}</Text>
                    </Space>
                  ),
                  description: (
                    <Space
                      orientation="vertical"
                      size={0}
                      style={{ width: "100%" }}
                    >
                      <Text>{diagnostic.message}</Text>
                      <Text type="secondary" style={{ marginTop: 4 }}>
                        影响：{diagnostic.severity === "error" ? "当前检查未通过，可能无法启动调试。" : "不阻塞调试，但建议处理。"}
                      </Text>
                      {suggestion && (
                        <Text type="secondary" style={{ marginTop: 4 }}>
                          建议：{suggestion}
                        </Text>
                      )}
                      {(diagnostic.sourcePath ||
                        diagnostic.fileId ||
                        diagnostic.nodeId) && (
                        <Space
                          orientation="vertical"
                          size={2}
                          style={{ marginTop: 4 }}
                        >
                          {diagnostic.sourcePath && (
                            <Text style={metaValueStyle}>
                              路径: {diagnostic.sourcePath}
                            </Text>
                          )}
                        </Space>
                      )}
                      {actions.length > 0 && (
                        <Space wrap style={{ marginTop: 8 }}>
                          {actions}
                        </Space>
                      )}
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ cursor: "pointer" }}>
                          开发者详情
                        </summary>
                        <Space
                          orientation="vertical"
                          size={2}
                          style={{ marginTop: 6, width: "100%" }}
                        >
                          <Text type="secondary">诊断编号: {diagnostic.code}</Text>
                          {diagnostic.fileId && (
                            <Text type="secondary">文件 ID: {diagnostic.fileId}</Text>
                          )}
                          {diagnostic.nodeId && (
                            <Text type="secondary">节点 ID: {diagnostic.nodeId}</Text>
                          )}
                          {diagnostic.fieldPath && (
                            <Text type="secondary">字段: {diagnostic.fieldPath}</Text>
                          )}
                          {diagnostic.nodeId && (
                            <Text type="secondary">节点 ID: {diagnostic.nodeId}</Text>
                          )}
                        </Space>
                      </details>
                    </Space>
                  ),
                })}
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

function severityLabel(severity: DebugDiagnostic["severity"]): string {
  switch (severity) {
    case "error":
      return "错误";
    case "warning":
      return "提醒";
    default:
      return "信息";
  }
}
