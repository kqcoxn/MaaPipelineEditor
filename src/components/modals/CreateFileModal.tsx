import { useState, useEffect, useMemo } from "react";
import { Modal, Form, Input, Select, message, Tooltip } from "antd";
import { FolderOutlined, FileOutlined, HomeFilled } from "@ant-design/icons";
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
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [previewFileName, setPreviewFileName] = useState<string>("");
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isValidFileName, setIsValidFileName] = useState(false);

  const rootPath = useLocalFileStore((state) => state.rootPath);
  const files = useLocalFileStore((state) => state.files);
  const currentFileName = useFileStore((state) => state.currentFile.fileName);

  // 提取目录列表
  const directoryOptions = useMemo(() => {
    const dirSet = new Set<string>();

    // 添加根目录
    if (rootPath) {
      dirSet.add(rootPath);
    }

    // 提取精简目录
    files.forEach((file) => {
      const path = file.file_path;
      const lastSep = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
      if (lastSep > 0) {
        dirSet.add(path.substring(0, lastSep));
      }
    });

    return Array.from(dirSet).sort();
  }, [rootPath, files]);

  // 显示名称
  const getDisplayPath = (
    fullPath: string
  ): { display: string; isRoot: boolean } => {
    if (!rootPath || fullPath === rootPath) {
      // 根目录显示文件夹名
      const lastSep = Math.max(
        fullPath.lastIndexOf("/"),
        fullPath.lastIndexOf("\\")
      );
      return {
        display: lastSep > 0 ? fullPath.substring(lastSep + 1) : fullPath,
        isRoot: true,
      };
    }

    // 相对路径
    if (fullPath.startsWith(rootPath)) {
      const relativePath = fullPath.substring(rootPath.length);
      return {
        display: relativePath.replace(/^[\/\\]/, "") || ".",
        isRoot: false,
      };
    }

    // 完整路径的最后部分
    const lastSep = Math.max(
      fullPath.lastIndexOf("/"),
      fullPath.lastIndexOf("\\")
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

      // 自动填充当前文件名
      const initialFileName = currentFileName || "";

      form.setFieldsValue({
        fileName: initialFileName,
        directory: rootPath || "",
        saveToLocal: true,
      });

      // 更新预览文件名和验证状态
      if (initialFileName && validateFileName(initialFileName)) {
        setPreviewFileName(normalizeFileName(initialFileName));
        setIsValidFileName(true);
        // 检查重名
        const duplicate = checkDuplicateFileName(
          initialFileName,
          rootPath || ""
        );
        setIsDuplicate(duplicate);
      } else {
        setIsValidFileName(false);
        setIsDuplicate(false);
      }
    }
  }, [visible, form, rootPath, currentFileName]);

  // 规范化文件名
  const normalizeFileName = (fileName: string): string => {
    if (!fileName) return "";

    const trimmed = fileName.trim();

    // 已有后缀
    if (trimmed.endsWith(".json") || trimmed.endsWith(".jsonc")) {
      return trimmed;
    }

    // 自动补全
    return `${trimmed}.json`;
  };

  // 验证文件名
  const validateFileName = (fileName: string): boolean => {
    if (!fileName) return false;

    const normalized = normalizeFileName(fileName);

    // 检查是否包含非法字符
    const invalidChars = /[\\/:*?"<>|]/;
    if (invalidChars.test(normalized)) {
      return false;
    }

    // 必须以.json或.jsonc结尾
    return normalized.endsWith(".json") || normalized.endsWith(".jsonc");
  };

  // 检查文件名是否在本地文件列表中已存在
  const checkDuplicateFileName = (
    fileName: string,
    directory: string
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

  // 处理文件名变化
  const handleFileNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const directory = form.getFieldValue("directory");

    // 验证文件名
    const isValid = validateFileName(value);
    setIsValidFileName(isValid);

    if (isValid) {
      setPreviewFileName(normalizeFileName(value));
      // 检查重名
      const duplicate = checkDuplicateFileName(value, directory);
      setIsDuplicate(duplicate);
    } else if (!value) {
      setPreviewFileName("");
      setIsDuplicate(false);
    } else {
      // 无效临时输入值
      setPreviewFileName("");
      setIsDuplicate(false);
    }
  };

  // 处理目录变化
  const handleDirectoryChange = (value: string) => {
    const fileName = form.getFieldValue("fileName");

    // 如果文件名有效，重新检查重名
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
        message.error("未连接到本地服务，无法创建文件");
        return;
      }

      // 检查重名
      if (isDuplicate) {
        message.warning("该目录下已存在同名文件，请使用不同的文件名");
        return;
      }

      setLoading(true);

      // 规范化文件名
      const normalizedFileName = normalizeFileName(fileName);

      // 获取当前编辑器的内容
      const content = flowToPipeline();

      // 通过协议请求创建文件
      const success = fileProtocol.requestCreateFile(
        normalizedFileName,
        directory,
        content
      );

      if (success) {
        message.success("文件创建请求已发送");
        onCancel();
        form.resetFields();
        setPreviewFileName("");
      } else {
        message.error("文件创建请求发送失败");
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
          <span style={{ marginLeft: 8 }}>新建本地文件</span>
        </span>
      }
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="创建"
      cancelText="取消"
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
          label="文件名"
          validateStatus={isDuplicate ? "error" : undefined}
          help={
            isDuplicate ? (
              <span style={{ color: "#ff4d4f" }}>
                该目录下已存在同名文件，请使用不同的文件名
              </span>
            ) : undefined
          }
          rules={[
            {
              validator: (_, value) => {
                if (!value) {
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
            placeholder="例如: pipeline 或 pipeline.json 或 pipeline.jsonc"
            prefix={<FileOutlined />}
            onChange={handleFileNameChange}
            status={isDuplicate ? "error" : undefined}
          />
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

        <Form.Item
          name="directory"
          label="保存目录"
          rules={[{ required: true, message: "请选择或输入保存目录" }]}
        >
          <Select
            showSearch
            allowClear
            placeholder="选择目录"
            optionFilterProp="label"
            onChange={handleDirectoryChange}
            options={directoryOptions.map((dir) => {
              const { display, isRoot } = getDisplayPath(dir);
              return {
                label: display,
                value: dir,
                title: dir, // 用于搜索匹配
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
            dropdownRender={(menu) => (
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
                    暂无可用目录，请先连接本地服务
                  </div>
                )}
              </>
            )}
          />
        </Form.Item>

        <Form.Item
          name="saveToLocal"
          label="保存选项"
          rules={[{ required: true }]}
        >
          <Select>
            <Select.Option value={true}>
              保存当前编辑器内容到新文件
            </Select.Option>
          </Select>
        </Form.Item>

        <Form.Item>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>
            <div>提示：</div>
            <div>• 文件名支持 .json 和 .jsonc 后缀</div>
            <div>• 不带后缀时自动补全为 .json</div>
            <div>• 保存目录快捷选择为相对路径，但自行输入时需要为绝对路径</div>
            <div>• 文件将创建在指定目录下，创建成功后会自动刷新文件列表</div>
            <div>
              • 「保存当前编辑器内容到新文件」会将画布中的节点编译为 Pipeline
              并写入新文件，您可以先点击Tab栏右侧的添加按钮再点击新建本地文件
            </div>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
};
