import { useId, useState } from "react";
import { Button, Typography } from "antd";
import { DownOutlined, RightOutlined } from "@ant-design/icons";
import type { DebugDiagnostic } from "../types";
import { getDebugDiagnosticSuggestion } from "../selectors/resourceHealth";
import { collectDiagnosticRows, diagnosticField, diagnosticNodeName } from "../selectors/diagnosticPresentation";
import styles from "./ResourceDiagnosticList.module.less";

const { Text } = Typography;

export function getResourceDiagnosticTitle(diagnostic: DebugDiagnostic): string {
  const target = diagnostic.data?.target;
  if (typeof target === "string") {
    if (diagnostic.code === "debug.resource.pipeline_node_missing") return `节点「${target}」不存在`;
    if (diagnostic.code === "debug.resource.pipeline_image_missing") return `图片「${target}」不存在`;
  }
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
    "debug.resolver.runtime_duplicate": "运行时节点来源不明确",
    "debug.resolver.edge_target_unknown": "快照中未找到连线终点",
    "debug.target.not_in_resolver": "调试目标无法映射到运行节点",
  };
  return titles[diagnostic.code] ?? (diagnostic.message.length > 60 ? `${diagnostic.message.slice(0, 60)}…` : diagnostic.message);
}

interface ResourceDiagnosticListProps {
  diagnostics: DebugDiagnostic[];
  focusFile: (fileId?: string, sourcePath?: string) => void;
  focusNode: (nodeId: string) => void;
}

function DiagnosticRow({ diagnostics, focusFile, focusNode }: ResourceDiagnosticListProps) {
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  const diagnostic = diagnostics[0];
  const multiple = diagnostics.length > 1;
  const node = diagnosticNodeName(diagnostic);
  const field = diagnosticField(diagnostic);
  const title = multiple ? `缺少 ${diagnostics.length} 项模板图片引用` : getResourceDiagnosticTitle(diagnostic);
  const suggestions = [...new Set(diagnostics.map(getDebugDiagnosticSuggestion).filter(Boolean))];
  const searchedPaths = [...new Set(diagnostics.flatMap((item) =>
    Array.isArray(item.data?.searchedPaths) ? item.data.searchedPaths.filter((path): path is string => typeof path === "string") : [],
  ))];
  const openFile = (item: DebugDiagnostic) => focusFile(item.fileId, item.sourcePath);
  const location = (item: DebugDiagnostic) => {
    const line = item.data?.line;
    const column = item.data?.column;
    return typeof line === "number" ? `L${line}${typeof column === "number" ? `:${column}` : ""}` : "打开文件";
  };

  return (
    <li className={styles.item}>
      <div className={styles.row}>
        <Text type={diagnostic.severity === "error" ? "danger" : diagnostic.severity === "warning" ? "warning" : "secondary"}>
          {diagnostic.severity === "error" ? "错误" : diagnostic.severity === "warning" ? "警告" : "提示"}
        </Text>
        {node && (diagnostic.nodeId ? (
          <Button type="link" size="small" className={styles.node} title={`定位节点：${node}`}
            onClick={() => { openFile(diagnostic); focusNode(diagnostic.nodeId!); }}>{node}</Button>
        ) : <span className={styles.node} title={node}>{node}</span>)}
        {field && <span className={styles.field} title={field}>{multiple ? field.replace(/\[\d+\]$/, "") : field}</span>}
        <button type="button" className={styles.toggle} aria-expanded={expanded} aria-controls={detailId}
          title={title} onClick={() => setExpanded(!expanded)}>
          <span className={styles.reason}>{title}</span>
          {expanded ? <DownOutlined aria-hidden /> : <RightOutlined aria-hidden />}
        </button>
        {!multiple && (diagnostic.fileId || diagnostic.sourcePath) && (
          <Button type="link" size="small" title={diagnostic.sourcePath} aria-label={`打开文件：${location(diagnostic)}`}
            onClick={() => openFile(diagnostic)}>{location(diagnostic)}</Button>
        )}
      </div>
      <div id={detailId} hidden={!expanded} className={styles.detail}>
        {expanded && <>
          {diagnostics.map((item, index) => (
            <div key={index} className={styles.detailItem}>
              {(multiple || item.message !== title) && <div>{item.message}</div>}
              {multiple && (item.fileId || item.sourcePath) && (
                <Button type="link" size="small" title={item.sourcePath} aria-label={`打开文件：${location(item)}`}
                  onClick={() => openFile(item)}>{location(item)}</Button>
              )}
            </div>
          ))}
          {suggestions.map((suggestion) => <Text key={suggestion} type="secondary">建议：{suggestion}</Text>)}
          {searchedPaths.length > 0 && (
            <div><Text type="secondary">查找范围：</Text>
              {searchedPaths.map((path) => <div key={path}>{path}</div>)}
            </div>
          )}
        </>}
      </div>
    </li>
  );
}

export function ResourceDiagnosticList({ diagnostics, ...actions }: ResourceDiagnosticListProps) {
  return <ul aria-label="资源诊断" className={styles.list}>
    {collectDiagnosticRows(diagnostics).map(({ key, items }) => <DiagnosticRow key={key} diagnostics={items} {...actions} />)}
  </ul>;
}
