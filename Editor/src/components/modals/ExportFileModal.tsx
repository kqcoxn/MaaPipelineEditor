import { useState, useEffect } from "react";
import { Modal, Form, Input, Select, message, Radio } from "antd";
import { FileOutlined, DownloadOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useFileStore } from "../../stores/fileStore";
import { useConfigStore } from "../../stores/configStore";
import {
  flowToPipelineString,
  flowToSeparatedStrings,
} from "../../core/parser";

interface ExportFileModalProps {
  visible: boolean;
  onCancel: () => void;
}

export const ExportFileModal: React.FC<ExportFileModalProps> = ({
  visible,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [previewFileName, setPreviewFileName] = useState<string>("");
  const [exportTarget, setExportTarget] = useState<
    "pipeline" | "config" | "both"
  >("both");

  const currentFileName = useFileStore((state) => state.currentFile.fileName);
  const configHandlingMode = useConfigStore(
    (state) => state.configs.configHandlingMode,
  );

  useEffect(() => {
    if (visible) {
      form.resetFields();

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

      setExportTarget(configHandlingMode === "separated" ? "both" : "pipeline");
      setPreviewFileName(`${baseName}.json`);
    }
  }, [visible, form, currentFileName, configHandlingMode]);

  const updatePreview = () => {
    const fileName = form.getFieldValue("fileName") || "";
    const format = form.getFieldValue("format") || "json";

    if (fileName.trim()) {
      if (configHandlingMode === "separated" && exportTarget === "both") {
        setPreviewFileName(
          `${fileName.trim()}.${format} + ${fileName.trim()}.mpe.json`,
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

  const handleFileNameChange = () => {
    updatePreview();
  };

  const handleFormatChange = () => {
    updatePreview();
  };

  const handleExportTargetChange = (value: "pipeline" | "config" | "both") => {
    setExportTarget(value);
    updatePreview();
  };

  const validateFileName = (fileName: string): boolean => {
    if (!fileName || !fileName.trim()) return false;

    const invalidChars = /[\\/:*?"<>|]/;
    return !invalidChars.test(fileName);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const { fileName, format } = values;

      const trimmedName = fileName.trim();

      if (configHandlingMode === "separated") {
        const { pipelineString, configString } = flowToSeparatedStrings();

        if (exportTarget === "both" || exportTarget === "pipeline") {
          await exportFile(`${trimmedName}.${format}`, pipelineString, format);
        }

        if (exportTarget === "both" || exportTarget === "config") {
          await exportFile(`${trimmedName}.mpe.json`, configString, "json");
        }

        message.success(
          exportTarget === "both"
            ? t(
                "ui.modals.exportFile.exportedBoth",
                "已导出 {{pipeline}} 和 {{config}}",
                {
                  pipeline: `${trimmedName}.${format}`,
                  config: `${trimmedName}.mpe.json`,
                },
              )
            : exportTarget === "pipeline"
              ? t(
                  "ui.modals.exportFile.exportedPipeline",
                  "已导出 {{fileName}}",
                  { fileName: `${trimmedName}.${format}` },
                )
              : t(
                  "ui.modals.exportFile.exportedConfig",
                  "已导出 {{fileName}}",
                  { fileName: `${trimmedName}.mpe.json` },
                ),
        );
      } else {
        const content = flowToPipelineString();
        await exportFile(`${trimmedName}.${format}`, content, format);
        message.success(
          t("ui.modals.exportFile.exportedPipeline", "已导出 {{fileName}}", {
            fileName: `${trimmedName}.${format}`,
          }),
        );
      }

      onCancel();
    } catch (error) {
      console.error("[ExportFileModal] Failed to export file:", error);
    }
  };

  const exportFile = async (
    fullFileName: string,
    content: string,
    format: string,
  ) => {
    if ("showSaveFilePicker" in window) {
      try {
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

        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return;
      } catch (err: any) {
        if (err.name === "AbortError") {
          throw err;
        }
        console.warn(
          "[ExportFileModal] File System Access API failed, fallback to download:",
          err,
        );
      }
    }

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
          <span style={{ marginLeft: 8 }}>
            {t("ui.modals.exportFile.title", "导出为文件")}
          </span>
        </span>
      }
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={t("ui.modals.exportFile.export", "导出")}
      cancelText={t("ui.modals.exportFile.cancel", "取消")}
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
          label={t("ui.modals.exportFile.fileNameLabel", "文件名")}
          rules={[
            {
              validator: (_, value) => {
                if (!value || !value.trim()) {
                  return Promise.reject(
                    t("ui.modals.exportFile.fileNameRequired", "请输入文件名"),
                  );
                }
                if (!validateFileName(value)) {
                  return Promise.reject(
                    t(
                      "ui.modals.exportFile.fileNameInvalid",
                      '文件名不能包含特殊字符 \\ / : * ? " < > |',
                    ),
                  );
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <Input
            placeholder={t(
              "ui.modals.exportFile.fileNamePlaceholder",
              "输入文件名（不含后缀）",
            )}
            prefix={<FileOutlined />}
            onChange={handleFileNameChange}
          />
        </Form.Item>

        <Form.Item
          name="format"
          label={t("ui.modals.exportFile.formatLabel", "导出格式")}
          rules={[
            {
              required: true,
              message: t("ui.modals.exportFile.formatRequired", "请选择导出格式"),
            },
          ]}
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
          <Form.Item label={t("ui.modals.exportFile.targetLabel", "导出目标")}>
            <Radio.Group
              value={exportTarget}
              onChange={(e) => handleExportTargetChange(e.target.value)}
            >
              <Radio value="both">
                {t("ui.modals.exportFile.targetBoth", "导出 Pipeline 和配置")}
              </Radio>
              <Radio value="pipeline">
                {t("ui.modals.exportFile.targetPipeline", "仅导出 Pipeline")}
              </Radio>
              <Radio value="config">
                {t("ui.modals.exportFile.targetConfig", "仅导出配置")}
              </Radio>
            </Radio.Group>
          </Form.Item>
        )}

        {previewFileName && (
          <Form.Item label={t("ui.modals.exportFile.previewLabel", "预览文件名")}>
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
            <div>{t("ui.modals.exportFile.hintsTitle", "提示：")}</div>
            <div>
              {t(
                "ui.modals.exportFile.hintCompile",
                "• 将当前画布内容编译为 Pipeline 并导出",
              )}
            </div>
            {configHandlingMode === "separated" && (
              <div>
                {t(
                  "ui.modals.exportFile.hintSeparated",
                  "• 分离模式下可选择导出 Pipeline、配置或两者",
                )}
              </div>
            )}
            <div>
              {t(
                "ui.modals.exportFile.hintDownload",
                "• 使用浏览器下载功能保存到本地",
              )}
            </div>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};
