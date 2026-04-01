import { Modal, Button, Space, Alert, Typography, Tooltip } from "antd";
import {
  CodeOutlined,
  FormatPainterOutlined,
  SaveOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { memo, useState, useCallback, useEffect } from "react";
import Editor from "@monaco-editor/react";
import type { editor, languages } from "monaco-editor";

/**
 * 位置接口（简化版 monaco.Position）
 */
interface Position {
  lineNumber: number;
  column: number;
}
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
  recoFields,
  actionFields,
  otherFieldSchemaKeyList,
  recoParamKeys,
  actionParamKeys,
} from "../../core/fields";

interface NodeJsonEditorModalProps {
  open: boolean;
  onClose: () => void;
  node: NodeType | null;
  onSave: (nodeData: any) => void;
}

const { Text } = Typography;

/**
 * 验证 JSON/JSONC 格式
 * 现阶段只验证格式是否正确，不验证业务规则
 */
function validateMfwNodeJson(jsonString: string): {
  valid: boolean;
  error?: string;
  data?: any;
} {
  let data: any;
  try {
    data = JSON.parse(jsonString);
  } catch (error: any) {
    return { valid: false, error: `JSON 语法错误: ${error.message}` };
  }

  return { valid: true, data };
}

// ============== 自动补全相关函数 ==============

/**
 * 获取识别类型列表
 */
function getRecognitionTypes(): string[] {
  return Object.keys(recoFields).sort();
}

/**
 * 获取动作类型列表
 */
function getActionTypes(): string[] {
  return Object.keys(actionFields).sort();
}

/**
 * 获取指定识别类型的字段 key 列表
 */
function getRecognitionFieldKeys(recognitionType: string): string[] {
  return recoParamKeys[recognitionType]?.all || [];
}

/**
 * 获取指定动作类型的字段 key 列表
 */
function getActionFieldKeys(actionType: string): string[] {
  return actionParamKeys[actionType]?.all || [];
}

/**
 * 获取 MaaFramework 顶层字段（非识别/动作专属字段）
 */
function getTopLevelFields(): string[] {
  // 这些是 MFW 的顶层字段，不在 otherFieldSchemaKeyList 中
  const specialTopLevelFields = ["recognition", "action", "next", "on_error"];

  return [...specialTopLevelFields, ...otherFieldSchemaKeyList].sort();
}

/**
 * 解析 JSON 文本，获取当前位置所在对象的 recognition 和 action 值
 */
function parseContext(
  model: editor.ITextModel,
  _position: Position,
): { recognition?: string; action?: string } {
  const result: { recognition?: string; action?: string } = {};

  try {
    const text = model.getValue();
    const fullJson = JSON.parse(text);

    // 简单情况：顶层对象
    if (fullJson.recognition) {
      result.recognition = fullJson.recognition;
    }
    if (fullJson.action) {
      result.action = fullJson.action;
    }
  } catch {
    // JSON 解析失败，忽略
  }

  return result;
}

/**
 * 检查是否在特定属性值的位置
 */
function checkPropertyValueContext(
  model: editor.ITextModel,
  position: Position,
): { isInRecognitionValue: boolean; isInActionValue: boolean } {
  const lineContent = model.getLineContent(position.lineNumber);
  const textUntilPosition = lineContent.substring(0, position.column - 1);

  // 检查是否在 recognition 值的位置
  const recognitionPattern = /"recognition"\s*:\s*"[^"]*$/;
  const isInRecognitionValue = recognitionPattern.test(textUntilPosition);

  // 检查是否在 action 值的位置
  const actionPattern = /"action"\s*:\s*"[^"]*$/;
  const isInActionValue = actionPattern.test(textUntilPosition);

  return { isInRecognitionValue, isInActionValue };
}

/**
 * 创建 Monaco Editor 补全提供者
 */
function createMfwCompletionProvider(): languages.CompletionItemProvider {
  return {
    triggerCharacters: ['"', "'"],
    provideCompletionItems: (model, position): languages.CompletionList => {
      const lineContent = model.getLineContent(position.lineNumber);
      const textUntilPosition = lineContent.substring(0, position.column - 1);

      // 提取当前已输入的内容
      const match = textUntilPosition.match(/["']([^"']*)$/);
      const currentInput = match ? match[1] : "";

      // 检查是否在 recognition 或 action 值的位置
      const { isInRecognitionValue, isInActionValue } =
        checkPropertyValueContext(model, position);

      // 如果在 recognition 值的位置，提示识别类型
      if (isInRecognitionValue) {
        const recognitionTypes = getRecognitionTypes();
        const suggestions: languages.CompletionItem[] = recognitionTypes.map(
          (type) => ({
            label: type,
            kind: 12, // monaco.languages.CompletionItemKind.Value
            insertText: type,
            detail: `识别类型: ${recoFields[type]?.desc?.split("。")[0] || ""}`,
            documentation: recoFields[type]?.desc || "",
            sortText: type.toLowerCase().startsWith(currentInput.toLowerCase())
              ? `0${type}`
              : `1${type}`,
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: position.column - currentInput.length,
              endColumn: position.column,
            },
          }),
        );
        return { suggestions };
      }

      // 如果在 action 值的位置，提示动作类型
      if (isInActionValue) {
        const actionTypes = getActionTypes();
        const suggestions: languages.CompletionItem[] = actionTypes.map(
          (type) => ({
            label: type,
            kind: 12,
            insertText: type,
            detail: `动作类型: ${actionFields[type]?.desc?.split("。")[0] || ""}`,
            documentation: actionFields[type]?.desc || "",
            sortText: type.toLowerCase().startsWith(currentInput.toLowerCase())
              ? `0${type}`
              : `1${type}`,
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: position.column - currentInput.length,
              endColumn: position.column,
            },
          }),
        );
        return { suggestions };
      }

      // 检查是否在 JSON key 的位置
      const keyPattern = /["'][^"']*$/;
      const isInKeyContext = keyPattern.test(textUntilPosition);

      // 检查是否在冒号前
      const beforeColonPattern = /["'][^"']*["']?\s*$/;
      const isBeforeColon =
        beforeColonPattern.test(textUntilPosition) &&
        !textUntilPosition.includes(":");

      if (!isInKeyContext && !isBeforeColon) {
        return { suggestions: [] };
      }

      // 获取当前上下文中的 recognition 和 action 值
      const context = parseContext(model, position);

      // 收集需要提示的字段
      const fieldKeys = new Set<string>();

      // 添加顶层字段
      getTopLevelFields().forEach((key) => fieldKeys.add(key));

      // 根据上下文添加识别字段
      if (context.recognition) {
        getRecognitionFieldKeys(context.recognition).forEach((key) =>
          fieldKeys.add(key),
        );
      } else {
        // 如果没有指定 recognition，添加所有识别字段
        Object.keys(recoFields).forEach((type) => {
          getRecognitionFieldKeys(type).forEach((key) => fieldKeys.add(key));
        });
      }

      // 根据上下文添加动作字段
      if (context.action) {
        getActionFieldKeys(context.action).forEach((key) => fieldKeys.add(key));
      } else {
        // 如果没有指定 action，添加所有动作字段
        Object.keys(actionFields).forEach((type) => {
          getActionFieldKeys(type).forEach((key) => fieldKeys.add(key));
        });
      }

      const suggestions: languages.CompletionItem[] = Array.from(fieldKeys)
        .sort()
        .map((key) => ({
          label: key,
          kind: 17,
          insertText: key,
          detail: "MaaFramework 字段",
          sortText: key.startsWith(currentInput) ? `0${key}` : `1${key}`,
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - currentInput.length,
            endColumn: position.column,
          },
        }));

      return { suggestions };
    },
  };
}

export const NodeJsonEditorModal = memo(
  ({ open, onClose, node, onSave }: NodeJsonEditorModalProps) => {
    const [jsonValue, setJsonValue] = useState<string>("");
    const [validationError, setValidationError] = useState<string | null>(null);

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
                // 注册自动补全提供者
                monaco.languages.registerCompletionItemProvider(
                  "json",
                  createMfwCompletionProvider(),
                );
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
