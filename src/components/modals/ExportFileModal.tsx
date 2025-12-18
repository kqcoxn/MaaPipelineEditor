import { useState, useEffect } from "react";
import { Modal, Form, Input, Select, message } from "antd";
import { FileOutlined, DownloadOutlined } from "@ant-design/icons";
import { useFileStore } from "../../stores/fileStore";
import { flowToPipelineString } from "../../core/parser";

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

  const currentFileName = useFileStore((state) => state.currentFile.fileName);

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

      setPreviewFileName(`${baseName}.json`);
    }
  }, [visible, form, currentFileName]);

  // 更新预览文件名
  const updatePreview = () => {
    const fileName = form.getFieldValue("fileName") || "";
    const format = form.getFieldValue("format") || "json";

    if (fileName.trim()) {
      setPreviewFileName(`${fileName.trim()}.${format}`);
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
      const fullFileName = `${trimmedName}.${format}`;

      // 获取内容
      const content = flowToPipelineString();

      // 创建 Blob 并下载
      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fullFileName;
      a.click();
      URL.revokeObjectURL(url);

      message.success(`已导出 ${fullFileName}`);
      onCancel();
    } catch (error) {
      console.error("[ExportFileModal] Failed to export file:", error);
    }
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
          <Select onChange={handleFormatChange}>
            <Select.Option value="json">.json</Select.Option>
            <Select.Option value="jsonc">.jsonc</Select.Option>
          </Select>
        </Form.Item>

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
            <div>• 使用浏览器下载功能保存到本地</div>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};
