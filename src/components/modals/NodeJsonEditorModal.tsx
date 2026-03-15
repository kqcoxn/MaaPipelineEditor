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
import { formatNodeJson } from "../../utils/nodeJsonValidator";
import { useConfigStore } from "../../stores/configStore";
import { parsePipelineNodeForExport } from "../../core/parser/nodeParser";
import type { PipelineNodeType } from "../../stores/flow";

interface NodeJsonEditorModalProps {
  open: boolean;
  onClose: () => void;
  node: NodeType | null;
  onSave: (nodeData: any) => void;
}

const { Text } = Typography;

/**
 * 将 MFW Pipeline Node 格式转换回 Store 格式
 */
function convertMfwToStoreFormat(
  mfwData: any,
  originalNode: NodeType
): any {
  if (!mfwData || typeof mfwData !== "object") {
    return originalNode.data;
  }

  // 对于非 Pipeline 节点，直接返回数据
  if (originalNode.type !== NodeTypeEnum.Pipeline) {
    return {
      ...originalNode.data,
      ...mfwData,
    };
  }

  // Pipeline 节点需要特殊处理
  const storeData: any = {
    label: mfwData.label || originalNode.data.label,
    recognition: {
      type: "DirectHit",
      param: {},
    },
    action: {
      type: "DoNothing",
      param: {},
    },
    others: {},
  };

  // 处理 recognition
  if (mfwData.recognition) {
    if (typeof mfwData.recognition === "string") {
      // v1 格式: recognition: "TemplateMatch"
      storeData.recognition.type = mfwData.recognition;
    } else if (typeof mfwData.recognition === "object") {
      // v2 格式: recognition: { type: "TemplateMatch", param: {...} }
      storeData.recognition.type = mfwData.recognition.type || "DirectHit";
      storeData.recognition.param = mfwData.recognition.param || {};
    }
  }

  // 处理 action
  if (mfwData.action) {
    if (typeof mfwData.action === "string") {
      // v1 格式: action: "Click"
      storeData.action.type = mfwData.action;
    } else if (typeof mfwData.action === "object") {
      // v2 格式: action: { type: "Click", param: {...} }
      storeData.action.type = mfwData.action.type || "DoNothing";
      storeData.action.param = mfwData.action.param || {};
    }
  }

  // 处理其他字段（排除已处理的字段）
  const processedKeys = new Set([
    "label",
    "recognition",
    "action",
    "next",
    "on_error",
    "$__mpe_code",
  ]);

  Object.keys(mfwData).forEach((key) => {
    if (!processedKeys.has(key)) {
      // 检查是否是识别参数或动作参数（v1 格式）
      const isRecoParam = !storeData.recognition.param[key] && key !== "recognition";
      const isActionParam = !storeData.action.param[key] && key !== "action";

      if (isRecoParam && isActionParam) {
        // 其他字段放入 others
        storeData.others[key] = mfwData[key];
      }
    }
  });

  // 保留原始节点的额外字段
  if ((originalNode.data as any).extras) {
    storeData.extras = (originalNode.data as any).extras;
  }
  if ((originalNode.data as any).handleDirection) {
    storeData.handleDirection = (originalNode.data as any).handleDirection;
  }

  return storeData;
}

/**
 * 验证 JSON/JSONC 格式
 * 现阶段只验证格式是否正确，不验证业务规则
 */
function validateMfwNodeJson(jsonString: string): { valid: boolean; error?: string; data?: any } {
  let data: any;
  try {
    data = JSON.parse(jsonString);
  } catch (error: any) {
    return { valid: false, error: `JSON 语法错误: ${error.message}` };
  }

  return { valid: true, data };
}

export const NodeJsonEditorModal = memo(
  ({ open, onClose, node, onSave }: NodeJsonEditorModalProps) => {
    const [jsonValue, setJsonValue] = useState<string>("");
    const [validationError, setValidationError] = useState<string | null>(null);
    const [editorMounted, setEditorMounted] = useState(false);

    const jsonIndent = useConfigStore((state) => state.configs.jsonIndent);

    // 将节点数据转换为 MFW 格式
    const convertNodeToMfwFormat = useCallback((node: NodeType): any => {
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
      } catch (error: any) {
        setValidationError(`JSON 语法错误: ${error.message}`);
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
      const storeData = convertMfwToStoreFormat(validationResult.data, node);

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
    const editorOptions = {
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: "on" as const,
      formatOnPaste: true,
      formatOnType: true,
      lineNumbers: "on" as const,
      renderWhitespace: "selection" as const,
      automaticLayout: true,
      fontSize: 14,
      tabSize: jsonIndent,
      insertSpaces: true,
    };

    if (!node) return null;

    return (
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CodeOutlined style={{ fontSize: 20 }} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>
              编辑节点 JSON
            </span>
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
        <Space direction="vertical" style={{ width: "100%" }} size="middle" onDoubleClick={(e: React.MouseEvent) => e.stopPropagation()}>
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
              onMount={() => setEditorMounted(true)}
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
  }
);

export default NodeJsonEditorModal;
