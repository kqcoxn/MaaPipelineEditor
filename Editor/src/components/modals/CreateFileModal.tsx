import { useState, useEffect, useMemo } from "react";
import { Modal, Form, Input, Select, message, Tooltip } from "antd";
import { FolderOutlined, FileOutlined, HomeFilled } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useLocalFileStore } from "../../stores/localFileStore";
import { useFileStore } from "../../stores/fileStore";
import { localServer, fileProtocol } from "../../services/server";
import { flowToPipeline } from "../../core/parser";

interface CreateFileModalProps {
  visible: boolean;
  onCancel: () => void;
}

export const CreateFileModal: React.FC<CreateFileModalProps> = ({
  visible,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [previewFileName, setPreviewFileName] = useState<string>("");
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isValidFileName, setIsValidFileName] = useState(false);

  const rootPath = useLocalFileStore((state) => state.rootPath);
  const files = useLocalFileStore((state) => state.files);
  const directories = useLocalFileStore((state) => state.directories);
  const currentFileName = useFileStore((state) => state.currentFile.fileName);
  const currentFilePath = useFileStore(
    (state) => state.currentFile.config.filePath,
  );
  const setFileConfig = useFileStore((state) => state.setFileConfig);

  const duplicateHelp = t(
    "ui.modals.createFile.duplicateHelp",
    "该目录下已存在同名文件，请使用不同的文件名",
  );

  // 提取目录列表（合并后端提供的目录和从文件路径推导的目录）
  const directoryOptions = useMemo(() => {
    const dirSet = new Set<string>();

    if (rootPath) {
      dirSet.add(rootPath);
    }

    directories.forEach((dir) => {
      dirSet.add(dir);
    });

    files.forEach((file) => {
      const path = file.file_path;
      const lastSep = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
      if (lastSep > 0) {
        dirSet.add(path.substring(0, lastSep));
      }
    });

    return Array.from(dirSet).sort();
  }, [rootPath, files, directories]);

  const getDisplayPath = (
    fullPath: string,
  ): { display: string; isRoot: boolean } => {
    if (!rootPath || fullPath === rootPath) {
      const lastSep = Math.max(
        fullPath.lastIndexOf("/"),
        fullPath.lastIndexOf("\\"),
      );
      return {
        display: lastSep > 0 ? fullPath.substring(lastSep + 1) : fullPath,
        isRoot: true,
      };
    }

    if (fullPath.startsWith(rootPath)) {
      const relativePath = fullPath.substring(rootPath.length);
      return {
        display: relativePath.replace(/^[\/\\]/, "") || ".",
        isRoot: false,
      };
    }

    const lastSep = Math.max(
      fullPath.lastIndexOf("/"),
      fullPath.lastIndexOf("\\"),
    );
    return {
      display: lastSep > 0 ? fullPath.substring(lastSep + 1) : fullPath,
      isRoot: false,
    };
  };

  useEffect(() => {
    if (visible) {
      form.resetFields();
      setPreviewFileName("");

      const initialFileName = currentFileName || "";

      let initialDirectory = rootPath || "";
      if (currentFilePath) {
        const lastSeparatorIndex = Math.max(
          currentFilePath.lastIndexOf("/"),
          currentFilePath.lastIndexOf("\\"),
        );
        if (lastSeparatorIndex > 0) {
          initialDirectory = currentFilePath.substring(0, lastSeparatorIndex);
        }
      }

      form.setFieldsValue({
        fileName: initialFileName,
        directory: initialDirectory,
        saveToLocal: true,
      });

      if (initialFileName && validateFileName(initialFileName)) {
        setPreviewFileName(normalizeFileName(initialFileName));
        setIsValidFileName(true);
        const duplicate = checkDuplicateFileName(
          initialFileName,
          initialDirectory,
        );
        setIsDuplicate(duplicate);
      } else {
        setIsValidFileName(false);
        setIsDuplicate(false);
      }
    }
  }, [visible, form, rootPath, currentFileName, currentFilePath]);

  const normalizeFileName = (fileName: string): string => {
    if (!fileName) return "";

    const trimmed = fileName.trim();

    if (trimmed.endsWith(".json") || trimmed.endsWith(".jsonc")) {
      return trimmed;
    }

    return `${trimmed}.json`;
  };

  const validateFileName = (fileName: string): boolean => {
    if (!fileName) return false;

    const normalized = normalizeFileName(fileName);

    const invalidChars = /[\\/:*?"<>|]/;
    if (invalidChars.test(normalized)) {
      return false;
    }

    return normalized.endsWith(".json") || normalized.endsWith(".jsonc");
  };

  const checkDuplicateFileName = (
    fileName: string,
    directory: string,
  ): boolean => {
    if (!fileName || !directory) return false;

    const normalized = normalizeFileName(fileName);
    const fullPath = `${directory}${
      directory.endsWith("/") || directory.endsWith("\\") ? "" : "/"
    }${normalized}`;

    return files.some((file) => {
      const filePath = file.file_path.replace(/\\/g, "/");
      const targetPath = fullPath.replace(/\\/g, "/");
      return filePath.toLowerCase() === targetPath.toLowerCase();
    });
  };

  const handleFileNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const directory = form.getFieldValue("directory");

    const isValid = validateFileName(value);
    setIsValidFileName(isValid);

    if (isValid) {
      setPreviewFileName(normalizeFileName(value));
      const duplicate = checkDuplicateFileName(value, directory);
      setIsDuplicate(duplicate);
    } else if (!value) {
      setPreviewFileName("");
      setIsDuplicate(false);
    } else {
      setPreviewFileName("");
      setIsDuplicate(false);
    }
  };

  const handleDirectoryChange = (value: string) => {
    const fileName = form.getFieldValue("fileName");

    if (fileName && validateFileName(fileName)) {
      const duplicate = checkDuplicateFileName(fileName, value);
      setIsDuplicate(duplicate);
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const { fileName, directory } = values;

      if (!localServer.isConnected()) {
        message.error(
          t(
            "ui.modals.createFile.notConnected",
            "未连接到本地服务，无法创建文件",
          ),
        );
        return;
      }

      if (isDuplicate) {
        message.warning(duplicateHelp);
        return;
      }

      setLoading(true);

      const normalizedFileName = normalizeFileName(fileName);

      const content = flowToPipeline();

      const success = fileProtocol.requestCreateFile(
        normalizedFileName,
        directory,
        content,
      );

      if (success) {
        message.success(
          t("ui.modals.createFile.requestSent", "文件创建请求已发送"),
        );
        onCancel();
        form.resetFields();
        setPreviewFileName("");
      } else {
        message.error(
          t("ui.modals.createFile.requestFailed", "文件创建请求发送失败"),
        );
      }
    } catch (error) {
      console.error("[CreateFileModal] Failed to create file:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setPreviewFileName("");
    setIsDuplicate(false);
    setIsValidFileName(false);
    onCancel();
  };

  return (
    <Modal
      title={
        <span>
          <FileOutlined />
          <span style={{ marginLeft: 8 }}>
            {t("ui.modals.createFile.title", "新建本地文件")}
          </span>
        </span>
      }
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText={t("ui.modals.createFile.create", "创建")}
      cancelText={t("ui.modals.createFile.cancel", "取消")}
      okButtonProps={{ disabled: !isValidFileName || isDuplicate }}
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
        initialValues={{
          directory: rootPath || "",
          saveToLocal: true,
        }}
      >
        <Form.Item
          name="fileName"
          label={t("ui.modals.createFile.fileNameLabel", "文件名")}
          validateStatus={isDuplicate ? "error" : undefined}
          help={
            isDuplicate ? (
              <span style={{ color: "#ff4d4f" }}>{duplicateHelp}</span>
            ) : undefined
          }
          rules={[
            {
              validator: (_, value) => {
                if (!value) {
                  return Promise.reject(
                    t("ui.modals.createFile.fileNameRequired", "请输入文件名"),
                  );
                }
                if (!validateFileName(value)) {
                  return Promise.reject(
                    t(
                      "ui.modals.createFile.fileNameInvalid",
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
              "ui.modals.createFile.fileNamePlaceholder",
              "例如: pipeline 或 pipeline.json 或 pipeline.jsonc",
            )}
            prefix={<FileOutlined />}
            onChange={handleFileNameChange}
            status={isDuplicate ? "error" : undefined}
          />
        </Form.Item>

        {previewFileName && (
          <Form.Item label={t("ui.modals.createFile.previewLabel", "预览文件名")}>
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

        <Form.Item
          name="directory"
          label={t("ui.modals.createFile.directoryLabel", "保存目录")}
          rules={[
            {
              required: true,
              message: t(
                "ui.modals.createFile.directoryRequired",
                "请选择或输入保存目录",
              ),
            },
          ]}
        >
          <Select
            showSearch
            allowClear
            placeholder={t("ui.modals.createFile.directoryPlaceholder", "选择目录")}
            optionFilterProp="label"
            onChange={handleDirectoryChange}
            options={directoryOptions.map((dir) => {
              const { display, isRoot } = getDisplayPath(dir);
              return {
                label: display,
                value: dir,
                title: dir,
              };
            })}
            optionRender={(option) => {
              const fullPath = option.value as string;
              const { display, isRoot } = getDisplayPath(fullPath);
              return (
                <Tooltip
                  title={fullPath}
                  placement="left"
                  mouseEnterDelay={0.5}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isRoot ? (
                      <HomeFilled
                        style={{ marginRight: 8, color: "#1890ff" }}
                      />
                    ) : (
                      <FolderOutlined style={{ marginRight: 8 }} />
                    )}
                    <span
                      style={{ overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      {display}
                    </span>
                  </div>
                </Tooltip>
              );
            }}
            popupRender={(menu) => (
              <>
                {menu}
                {directoryOptions.length === 0 && (
                  <div
                    style={{
                      padding: "8px 12px",
                      color: "#999",
                      textAlign: "center",
                    }}
                  >
                    {t(
                      "ui.modals.createFile.noDirectory",
                      "暂无可用目录，请先连接本地服务",
                    )}
                  </div>
                )}
              </>
            )}
          />
        </Form.Item>

        <Form.Item
          name="saveToLocal"
          label={t("ui.modals.createFile.saveOptionsLabel", "保存选项")}
          rules={[{ required: true }]}
        >
          <Select
            options={[
              {
                value: true,
                label: t(
                  "ui.modals.createFile.saveCurrentContent",
                  "保存当前编辑器内容到新文件",
                ),
              },
            ]}
          />
        </Form.Item>

        <Form.Item>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>
            <div>{t("ui.modals.createFile.hintsTitle", "提示：")}</div>
            <div>
              {t(
                "ui.modals.createFile.hintExtensions",
                "• 文件名支持 .json 和 .jsonc 后缀",
              )}
            </div>
            <div>
              {t(
                "ui.modals.createFile.hintAutoExt",
                "• 不带后缀时自动补全为 .json",
              )}
            </div>
            <div>
              {t(
                "ui.modals.createFile.hintPath",
                "• 保存目录快捷选择为相对路径，但自行输入时需要为绝对路径",
              )}
            </div>
            <div>
              {t(
                "ui.modals.createFile.hintRefresh",
                "• 文件将创建在指定目录下，创建成功后会自动刷新文件列表",
              )}
            </div>
            <div>
              {t(
                "ui.modals.createFile.hintSaveContent",
                "• 「保存当前编辑器内容到新文件」会将画布中的节点编译为 Pipeline 并写入新文件，您可以先点击Tab栏右侧的添加按钮再点击新建本地文件",
              )}
            </div>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};
