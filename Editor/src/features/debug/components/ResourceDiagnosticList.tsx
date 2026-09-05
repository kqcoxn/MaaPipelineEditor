import { Button, Space, Tag, Typography } from "antd";
import { FileTextOutlined, NodeIndexOutlined } from "@ant-design/icons";
import type { DebugDiagnostic } from "../types";
import { getDebugDiagnosticSuggestion } from "../selectors/resourceHealth";

const { Text } = Typography;

export function getResourceDiagnosticTitle(diagnostic: DebugDiagnostic): string {
  const titles: Record<string, string> = {
    "debug.resource.load_failed": "资源包加载失败",
    "debug.resource.load_skipped": "资源包尚未加载",
    "debug.resource.load_unavailable": "MaaFW 尚未初始化",
    "debug.resource.pipeline_json_invalid": "Pipeline 文件格式错误",
    "debug.resource.pipeline_node_name_duplicate": "Pipeline 节点名称重复",
    "debug.resource.pipeline_node_missing": "引用的节点不存在",
    "debug.resource.pipeline_image_missing": "引用的图片不存在",
    "debug.resource.pipeline_image_dynamic": "图片需要在运行时提供",
    "debug.resource.pipeline_image_unreadable": "无法检查图片文件",
    "debug.resource.pipeline_image_path_separator": "图片路径存在跨平台风险",
    "debug.graph.empty": "当前没有可检查的流程",
    "debug.resolver.runtime_duplicate": "运行时节点名称重复",
    "debug.resolver.edge_target_unknown": "流程连线指向不存在的节点",
    "debug.target.not_in_resolver": "调试目标无法映射到运行节点",
  };
  return titles[diagnostic.code] ?? diagnostic.message;
}

interface ResourceDiagnosticListProps {
  diagnostics: DebugDiagnostic[];
  focusFile: (fileId?: string, sourcePath?: string) => void;
  focusNode: (nodeId: string) => void;
}

export function ResourceDiagnosticList({ diagnostics, focusFile, focusNode }: ResourceDiagnosticListProps) {
  return (
    <ol aria-label="资源诊断" style={{ margin: 0, paddingInlineStart: 24, overflowWrap: "anywhere" }}>
      {diagnostics.map((diagnostic, index) => (
        <li key={`${diagnostic.code}:${diagnostic.sourcePath}:${diagnostic.fieldPath}:${index}`} style={{ paddingBlock: 8 }}>
          <Space orientation="vertical" size={4} style={{ width: "100%" }}>
            <Space wrap>
              <Tag color={diagnostic.severity === "error" ? "error" : diagnostic.severity === "warning" ? "warning" : "processing"}>
                {diagnostic.severity === "error" ? "错误" : diagnostic.severity === "warning" ? "警告" : "提示"}
              </Tag>
              <Text strong>{getResourceDiagnosticTitle(diagnostic)}</Text>
            </Space>
            <Text>{diagnostic.message}</Text>
            {diagnostic.sourcePath && <Text>文件：{diagnostic.sourcePath}</Text>}
            {typeof diagnostic.data?.nodeName === "string" && <Text>节点：{diagnostic.data.nodeName}</Text>}
            {diagnostic.fieldPath && <Text>字段：{diagnostic.fieldPath}</Text>}
            {typeof diagnostic.data?.line === "number" && (
              <Text>位置：第 {diagnostic.data.line} 行{typeof diagnostic.data.column === "number" ? `，第 ${diagnostic.data.column} 列` : ""}</Text>
            )}
            {getDebugDiagnosticSuggestion(diagnostic) && <Text type="secondary">建议：{getDebugDiagnosticSuggestion(diagnostic)}</Text>}
            <Space wrap>
              {(diagnostic.fileId || diagnostic.sourcePath) && (
                <Button size="small" icon={<FileTextOutlined aria-hidden />} onClick={() => focusFile(diagnostic.fileId, diagnostic.sourcePath)}>打开文件</Button>
              )}
              {diagnostic.nodeId && (
                <Button size="small" icon={<NodeIndexOutlined aria-hidden />} onClick={() => { focusFile(diagnostic.fileId, diagnostic.sourcePath); focusNode(diagnostic.nodeId!); }}>定位节点</Button>
              )}
            </Space>
          </Space>
        </li>
      ))}
    </ol>
  );
}
