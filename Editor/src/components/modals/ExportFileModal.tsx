import { useState, useEffect } from "react";
import { App as AntdApp, Modal, Form, Input, Select, Radio } from "antd";
import { FileOutlined, DownloadOutlined } from "@ant-design/icons";
import { useFileStore } from "../../stores/fileStore";
import { useConfigStore } from "../../stores/configStore";
import {
  flowToPipelineString,
  flowToSeparatedStrings,
} from "../../core/parser";
import { useDocumentStore } from "../../stores/documentStore";
import type { DocumentId } from "../../features/project-session/types";
import {
  createPipelineSourceExports,
  type PipelineSourceExportFormat,
} from "../../features/pipeline-document/pipelineSourceExport";

interface ExportFileModalProps {
  visible: boolean;
  onCancel: () => void;
  documentId?: DocumentId;
}

export const ExportFileModal: React.FC<ExportFileModalProps> = ({
  visible,
  onCancel,
  documentId,
}) => {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [previewFileName, setPreviewFileName] = useState<string>("");
  const [exportTarget, setExportTarget] = useState<
    "pipeline" | "config" | "both"
  >("both");

  const legacyFileName = useFileStore((state) => state.currentFile.fileName);
  const sourceDocument = useDocumentStore((state) =>
    documentId ? state.opened[documentId] : undefined,
  );
  const linkedSourceDocument = useDocumentStore((state) =>
    sourceDocument
      ? sourceDocument.linkedDocumentIds
          .map((linkedId) => state.opened[linkedId])
          .find((document) => document?.descriptor.role === "mpe_config")
      : undefined,
  );
  const currentFileName = sourceDocument?.descriptor.name ?? legacyFileName;
  const sourceBacked = sourceDocument?.descriptor.kind === "pipeline";
  const configHandlingMode = useConfigStore(
    (state) => state.configs.configHandlingMode
  );

  useEffect(() => {
    if (visible) {
      form.resetFields();

      // 从当前文件名提取基础名称
      let baseName = currentFileName || "pipeline";
      if (baseName.endsWith(".json")) {
        baseName = baseName.slice(0, -5);
      } else if (baseName.endsWith(".jsonc")) {
        baseName = baseName.slice(0, -6);
      }

      const sourceFormat = currentFileName.toLowerCase().endsWith(".jsonc")
        ? "jsonc"
        : "json";
      form.setFieldsValue({
        fileName: baseName,
        format: sourceFormat,
      });

      // 分离模式默认导出两个文件
      setExportTarget(
        configHandlingMode === "separated" && linkedSourceDocument
          ? "both"
          : "pipeline",
      );
      setPreviewFileName(`${baseName}.${sourceFormat}`);
    }
  }, [visible, form, currentFileName, configHandlingMode, linkedSourceDocument]);

  // 更新预览文件名
  const updatePreview = () => {
    const fileName = form.getFieldValue("fileName") || "";
    const format = form.getFieldValue("format") || "json";

    if (fileName.trim()) {
      if (configHandlingMode === "separated" && exportTarget === "both") {
        setPreviewFileName(
          `${fileName.trim()}.${format} + ${fileName.trim()}.mpe.json`
        );
      } else if (
        configHandlingMode === "separated" &&
        exportTarget === "config"
      ) {
        setPreviewFileName(`${fileName.trim()}.mpe.json`);
      } else {
        setPreviewFileName(`${fileName.trim()}.${format}`);
      }
    } else {
      setPreviewFileName("");
    }
  };

  // 处理文件名变化
  const handleFileNameChange = () => {
    updatePreview();
  };

  // 处理格式变化
  const handleFormatChange = () => {
    updatePreview();
  };

  // 处理导出目标变化
  const handleExportTargetChange = (value: "pipeline" | "config" | "both") => {
    setExportTarget(value);
    updatePreview();
  };

  // 验证文件名
  const validateFileName = (fileName: string): boolean => {
    if (!fileName || !fileName.trim()) return false;

    // 检查是否包含非法字符
    const invalidChars = /[\\/:*?"<>|]/;
    return !invalidChars.test(fileName);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const { fileName, format } = values;

      const trimmedName = fileName.trim();

      if (sourceBacked && sourceDocument) {
        const exports = createPipelineSourceExports({
          baseName: trimmedName,
          format: format as PipelineSourceExportFormat,
          target: exportTarget,
          pipelineText: sourceDocument.workingText,
          configText: linkedSourceDocument?.workingText,
        });
        for (const file of exports) {
          await exportFile(file.name, file.text, file.format);
        }
        message.success(`已导出 ${exports.map((file) => file.name).join("、")}`);
        onCancel();
        return;
      }

      if (configHandlingMode === "separated") {
        // 分离模式导出
        const { pipelineString, configString } = flowToSeparatedStrings();

        if (exportTarget === "both" || exportTarget === "pipeline") {
          await exportFile(`${trimmedName}.${format}`, pipelineString, format);
        }

        if (exportTarget === "both" || exportTarget === "config") {
          await exportFile(`${trimmedName}.mpe.json`, configString, "json");
        }

        message.success(
          exportTarget === "both"
            ? `已导出 ${trimmedName}.${format} 和 ${trimmedName}.mpe.json`
            : exportTarget === "pipeline"
            ? `已导出 ${trimmedName}.${format}`
            : `已导出 ${trimmedName}.mpe.json`
        );
      } else {
        // 集成模式导出
        const content = flowToPipelineString();
        await exportFile(`${trimmedName}.${format}`, content, format);
        message.success(`已导出 ${trimmedName}.${format}`);
      }

      onCancel();
    } catch (error) {
      console.error("[ExportFileModal] Failed to export file:", error);
    }
  };

  // 导出文件的通用函数
  const exportFile = async (
    fullFileName: string,
    content: string,
    format: string
  ) => {
    // 检查是否支持 File System Access API
    if ("showSaveFilePicker" in window) {
      try {
        // 使用 File System Access API 选择保存位置
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fullFileName,
          types: [
            {
              description: "JSON Files",
              accept: {
                "application/json": [`.${format}`],
              },
            },
          ],
        });

        // 创建可写流并写入内容
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return;
      } catch (err: any) {
        // 用户取消选择
        if (err.name === "AbortError") {
          throw err;
        }
        console.warn(
          "[ExportFileModal] File System Access API failed, fallback to download:",
          err
        );
      }
    }

    // 降级使用传统下载方式
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fullFileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCancel = () => {
    form.resetFields();
    setPreviewFileName("");
    onCancel();
  };

  return (
    <Modal
      title={
        <span>
          <DownloadOutlined />
          <span style={{ marginLeft: 8 }}>导出为文件</span>
        </span>
      }
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="导出"
      cancelText="取消"
      okButtonProps={{
        disabled: !previewFileName,
      }}
      width={400}
    >
      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
        initialValues={{
          format: "json",
        }}
      >
        <Form.Item
          name="fileName"
          label="文件名"
          rules={[
            {
              validator: (_, value) => {
                if (!value || !value.trim()) {
                  return Promise.reject("请输入文件名");
                }
                if (!validateFileName(value)) {
                  return Promise.reject(
                    '文件名不能包含特殊字符 \\ / : * ? " < > |'
                  );
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <Input
            placeholder="输入文件名（不含后缀）"
            prefix={<FileOutlined />}
            onChange={handleFileNameChange}
          />
        </Form.Item>

        <Form.Item
          name="format"
          label="导出格式"
          rules={[{ required: true, message: "请选择导出格式" }]}
        >
          <Select
            disabled={sourceBacked}
            options={[
              { value: "json", label: ".json" },
              { value: "jsonc", label: ".jsonc" },
            ]}
            onChange={handleFormatChange}
          />
        </Form.Item>

        {configHandlingMode === "separated" &&
          (!sourceBacked || linkedSourceDocument) && (
            <Form.Item label="导出目标">
              <Radio.Group
                value={exportTarget}
                onChange={(e) => handleExportTargetChange(e.target.value)}
              >
                <Radio value="both">导出 Pipeline 和配置</Radio>
                <Radio value="pipeline">仅导出 Pipeline</Radio>
                <Radio value="config">仅导出配置</Radio>
              </Radio.Group>
            </Form.Item>
          )}

        {previewFileName && (
          <Form.Item label="预览文件名">
            <div
              style={{
                padding: "8px 12px",
                background: "#f5f5f5",
                borderRadius: "4px",
                color: "#52c41a",
                fontWeight: 500,
              }}
            >
              {previewFileName}
            </div>
          </Form.Item>
        )}

        <Form.Item>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>
            <div>提示：</div>
            <div>
              • {sourceBacked ? "按当前源码原样导出" : "将当前画布编译为 Pipeline"}
            </div>
            {configHandlingMode === "separated" && (
              <div>• 分离模式下可选择导出 Pipeline、配置或两者</div>
            )}
            <div>• 使用浏览器下载功能保存到本地</div>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};
