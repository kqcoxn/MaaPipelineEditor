import { Modal, Button, Space, Alert, Typography, Tooltip } from "antd";
import {
  CodeOutlined,
  FormatPainterOutlined,
  SaveOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { memo, useState, useCallback, useEffect } from "react";
import Editor from "@monaco-editor/react";
import type { NodeType } from "../../stores/flow/types";
import { NodeTypeEnum } from "../flow/nodes";
import { formatNodeJson } from "../../utils/node/nodeJsonValidator";
import { useConfigStore } from "../../stores/configStore";
import {
  parsePipelineNodeForExport,
  convertMfwToStoreFormat,
} from "../../core/parser/nodeParser";
import type { PipelineNodeType } from "../../stores/flow";
import {
  createMfwJsonEditorOptions,
  ensureMfwJsonCompletionProvider,
} from "../json/mfwJsonCompletion";

interface NodeJsonEditorModalProps {
  open: boolean;
  onClose: () => void;
  node: NodeType | null;
  onSave: (nodeData: NodeType["data"]) => void;
}

const { Text } = Typography;

/**
 * 验证 JSON/JSONC 格式
 * 现阶段只验证格式是否正确，不验证业务规则
 */
function validateMfwNodeJson(jsonString: string): {
  valid: boolean;
  error?: string;
  data?: unknown;
} {
  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch (error: unknown) {
    return { valid: false, error: `JSON 语法错误: ${getErrorMessage(error)}` };
  }

  return { valid: true, data };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "无法解析";
}

export const NodeJsonEditorModal = memo(
  ({ open, onClose, node, onSave }: NodeJsonEditorModalProps) => {
    const [jsonValue, setJsonValue] = useState<string>("");
    const [validationError, setValidationError] = useState<string | null>(null);

    const jsonIndent = useConfigStore((state) => state.configs.jsonIndent);

    // 将节点数据转换为 MFW 格式
    const convertNodeToMfwFormat = useCallback((node: NodeType): unknown => {
      if (node.type === NodeTypeEnum.Pipeline) {
        return parsePipelineNodeForExport(node as unknown as PipelineNodeType);
      }
      // 其他节点类型直接返回 data
      return node.data;
    }, []);

    // 当模态框打开时，初始化 JSON 值
    useEffect(() => {
      if (open && node) {
        const mfwData = convertNodeToMfwFormat(node);
        const initialJson = JSON.stringify(mfwData, null, jsonIndent);
        setJsonValue(initialJson);
        setValidationError(null);
      }
    }, [open, node, jsonIndent, convertNodeToMfwFormat]);

    // 处理编辑器内容变化
    const handleEditorChange = useCallback((value: string | undefined) => {
      const newValue = value || "";
      setJsonValue(newValue);

      // 实时验证 JSON 语法
      try {
        JSON.parse(newValue);
        setValidationError(null);
      } catch (error: unknown) {
        setValidationError(`JSON 语法错误: ${getErrorMessage(error)}`);
      }
    }, []);

    // 格式化 JSON
    const handleFormat = useCallback(() => {
      const formatted = formatNodeJson(jsonValue, jsonIndent);
      setJsonValue(formatted);
      setValidationError(null);
    }, [jsonValue, jsonIndent]);

    // 保存
    const handleSave = useCallback(() => {
      if (!node) return;

      // 验证 JSON 格式
      const validationResult = validateMfwNodeJson(jsonValue);

      if (!validationResult.valid) {
        setValidationError(validationResult.error || "验证失败");
        return;
      }

      // 将 MFW 格式转换回 Store 格式
      const storeData = convertMfwToStoreFormat(
        validationResult.data,
        node,
      ) as NodeType["data"];

      // 保存数据
      onSave(storeData);
      onClose();
    }, [jsonValue, node, onSave, onClose]);

    // 获取节点类型显示名称
    const getNodeTypeLabel = (type: NodeTypeEnum): string => {
      switch (type) {
        case NodeTypeEnum.Pipeline:
          return "Pipeline";
        case NodeTypeEnum.External:
          return "External";
        case NodeTypeEnum.Anchor:
          return "Anchor";
        case NodeTypeEnum.Sticker:
          return "Sticker";
        case NodeTypeEnum.Group:
          return "Group";
        default:
          return "Unknown";
      }
    };

    // 编辑器配置
    const editorOptions = createMfwJsonEditorOptions(jsonIndent);

    if (!node) return null;

    return (
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CodeOutlined style={{ fontSize: 20 }} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>编辑节点 JSON</span>
            <Text type="secondary" style={{ fontSize: 14, marginLeft: 8 }}>
              {getNodeTypeLabel(node.type)} - {node.data.label || "未命名"}
            </Text>
          </div>
        }
        open={open}
        onCancel={onClose}
        width={900}
        centered
        style={{ maxHeight: "90vh" }}
        footer={[
          <Button key="cancel" onClick={onClose} icon={<CloseOutlined />}>
            取消
          </Button>,
          <Tooltip key="format-tooltip" title="格式化 JSON">
            <Button
              key="format"
              onClick={handleFormat}
              icon={<FormatPainterOutlined />}
            >
              格式化
            </Button>
          </Tooltip>,
          <Button
            key="save"
            type="primary"
            onClick={handleSave}
            icon={<SaveOutlined />}
            disabled={!!validationError}
          >
            保存
          </Button>,
        ]}
        styles={{
          body: {
            padding: "16px 24px",
          },
        }}
      >
        <Space
          direction="vertical"
          style={{ width: "100%" }}
          size="middle"
          onDoubleClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {/* 编辑器 */}
          <div
            style={{
              border: "1px solid #d9d9d9",
              borderRadius: 6,
              overflow: "hidden",
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <Editor
              height={600}
              language="json"
              value={jsonValue}
              onChange={handleEditorChange}
              onMount={(_editorInstance, monaco) => {
                ensureMfwJsonCompletionProvider(monaco);
              }}
              options={editorOptions}
              theme="vs"
            />
          </div>

          {/* 错误提示 */}
          {validationError && (
            <Alert
              message={validationError}
              type="error"
              showIcon
              closable
              onClose={() => setValidationError(null)}
            />
          )}
        </Space>
      </Modal>
    );
  },
);

export default NodeJsonEditorModal;
