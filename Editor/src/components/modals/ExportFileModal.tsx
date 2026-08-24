import { useState, useEffect } from "react";
import { Modal, Form, Input, Select, message, Radio } from "antd";
import { FileOutlined, DownloadOutlined } from "@ant-design/icons";
import { useFileStore } from "@/stores/project/fileStore";
import { useConfigStore } from "@/stores/app/configStore";
import {
  flowToPipelineString,
  flowToSeparatedStrings,
  getConfigFileName,
} from "../../core/parser";

interface ExportFileModalProps {
  visible: boolean;
  onCancel: () => void;
}

export const ExportFileModal: React.FC<ExportFileModalProps> = ({
  visible,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const [previewFileName, setPreviewFileName] = useState<string>("");
  const [exportTarget, setExportTarget] = useState<
    "pipeline" | "config" | "both"
  >("both");

  const currentFileName = useFileStore((state) => state.currentFile.fileName);
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

      form.setFieldsValue({
        fileName: baseName,
        format: "json",
      });

      // 分离模式默认导出两个文件，并在预览中展示两个实际文件名
      const initialExportTarget =
        configHandlingMode === "separated" ? "both" : "pipeline";
      const pipelineFileName = `${baseName}.json`;
      const configFileName = getConfigFileName(pipelineFileName);
      setExportTarget(initialExportTarget);
      setPreviewFileName(
        initialExportTarget === "both"
          ? `${pipelineFileName} + ${configFileName}`
          : pipelineFileName
      );
    }
  }, [visible, form, currentFileName, configHandlingMode]);

  // 更新预览文件名
  const updatePreview = (
    nextExportTarget: "pipeline" | "config" | "both" = exportTarget
  ) => {
    const fileName = form.getFieldValue("fileName") || "";
    const format = form.getFieldValue("format") || "json";

    if (fileName.trim()) {
      const pipelineFileName = `${fileName.trim()}.${format}`;
      const configFileName = getConfigFileName(pipelineFileName);

      if (configHandlingMode === "separated" && nextExportTarget === "both") {
        setPreviewFileName(`${pipelineFileName} + ${configFileName}`);
      } else if (
        configHandlingMode === "separated" &&
        nextExportTarget === "config"
      ) {
        setPreviewFileName(configFileName);
      } else {
        setPreviewFileName(pipelineFileName);
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
    updatePreview(value);
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

      if (configHandlingMode === "separated") {
        // 分离模式导出
        const { pipelineString, configString } = flowToSeparatedStrings();
        const pipelineFileName = `${trimmedName}.${format}`;
        const configFileName = getConfigFileName(pipelineFileName);

        if (exportTarget === "both" || exportTarget === "pipeline") {
          await exportFile(pipelineFileName, pipelineString, format);
        }

        if (exportTarget === "both" || exportTarget === "config") {
          await exportFile(configFileName, configString, "json");
        }

        message.success(
          exportTarget === "both"
            ? `已导出 ${pipelineFileName} 和 ${configFileName}`
            : exportTarget === "pipeline"
            ? `已导出 ${pipelineFileName}`
            : `已导出 ${configFileName}`
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
            options={[
              { value: "json", label: ".json" },
              { value: "jsonc", label: ".jsonc" },
            ]}
            onChange={handleFormatChange}
          />
        </Form.Item>

        {configHandlingMode === "separated" && (
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
            <div>• 将当前画布内容编译为 Pipeline 并导出</div>
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
