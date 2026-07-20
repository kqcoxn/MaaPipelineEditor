import {
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  Button,
  Space,
  Spin,
  Divider,
  Tooltip,
  message,
} from "antd";
import {
  SettingOutlined,
  ReloadOutlined,
  FolderOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { configProtocol, localServer } from "../../services/server";
import type {
  BackendConfig,
  ConfigResponse,
} from "../../services/protocols/ConfigProtocol";
import {
  isWailsEnvironment,
  setRootDir as wailsSetRootDir,
  restartBridge as wailsRestartBridge,
} from "../../utils/wailsBridge";
import uiT from "../../i18n/translate";

interface BackendConfigModalProps {
  open: boolean;
  onClose: () => void;
}

const BackendConfigModal = ({ open, onClose }: BackendConfigModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [configPath, setConfigPath] = useState("");

  // 加载配置
  const loadConfig = useCallback(() => {
    if (!localServer.isConnected()) {
      message.warning(
        t("ui.modals.backendConfig.connectFirst", "请先连接本地服务"),
      );
      return;
    }

    setLoading(true);
    configProtocol.requestGetConfig();
  }, [t]);

  // 处理配置数据
  useEffect(() => {
    if (!open) return;

    const unsubscribe = configProtocol.onConfigData((data: ConfigResponse) => {
      setLoading(false);
      setSaving(false);

      if (data.success && data.config) {
        // 设置表单值
        form.setFieldsValue({
          server_port: data.config.server.port,
          server_host: data.config.server.host,
          file_root: data.config.file.root,
          file_exclude: data.config.file.exclude.join(", "),
          file_extensions: data.config.file.extensions.join(", "),
          file_max_depth: data.config.file.max_depth,
          file_max_files: data.config.file.max_files,
          log_level: data.config.log.level,
          log_dir: data.config.log.dir,
          log_push_to_client: data.config.log.push_to_client,
          maafw_enabled: data.config.maafw.enabled,
          maafw_lib_dir: data.config.maafw.lib_dir,
          maafw_resource_dir: data.config.maafw.resource_dir,
        });
        setConfigPath(data.config_path);

        // 如果是保存后的响应，自动触发重载并关闭面板
        if (data.message) {
          Modal.info({
            title: t("ui.modals.backendConfig.savedTitle", "配置已保存"),
            content: (
              <div>
                <p>{data.message}</p>
                <p style={{ marginTop: 12, color: "#52c41a" }}>
                  {t(
                    "ui.modals.backendConfig.savedReloadHint",
                    "已重载配置，部分配置（如端口）可能需要重启服务才能生效",
                  )}
                </p>
              </div>
            ),
            okText: t("ui.modals.backendConfig.gotIt", "知道了"),
            onOk: () => {
              onClose();
            },
          });

          // 延迟500ms后自动触发重载
          setTimeout(() => {
            setReloading(true);
            const success = configProtocol.requestReload();
            if (!success) {
              message.error(
                t(
                  "ui.modals.backendConfig.autoReloadFailed",
                  "自动重载失败，请手动点击重启按钮",
                ),
              );
              setReloading(false);
            }
          }, 500);
        }
      }
    });

    // 打开时加载配置
    loadConfig();

    return unsubscribe;
  }, [open, form, loadConfig, onClose, t]);

  // 监听重载响应
  useEffect(() => {
    const unsubscribe = configProtocol.onReload(() => {
      setReloading(false);
    });

    return unsubscribe;
  }, []);

  // 保存配置
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const config: Partial<BackendConfig> = {
        server: {
          port: values.server_port,
          host: values.server_host,
        },
        file: {
          root: values.file_root,
          exclude: values.file_exclude
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean),
          extensions: values.file_extensions
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean),
          max_depth: values.file_max_depth,
          max_files: values.file_max_files,
        },
        log: {
          level: values.log_level,
          dir: values.log_dir,
          push_to_client: values.log_push_to_client,
        },
        maafw: {
          enabled: values.maafw_enabled,
          lib_dir: values.maafw_lib_dir,
          resource_dir: values.maafw_resource_dir,
        },
      };

      // 如果在 Desktop 环境中且根目录有值，同步保存到 Desktop 配置
      if (isWailsEnvironment() && values.file_root) {
        try {
          const success = await wailsSetRootDir(values.file_root);
          if (success === false) {
            message.warning(
              t(
                "ui.modals.backendConfig.desktopSaveFailed",
                "Desktop 配置保存失败，但 LocalBridge 配置将继续保存",
              ),
            );
          }
        } catch (error) {
          console.error(
            uiT(
              "ui.modals.backendConfig.desktopRootSaveFailed",
              "保存 Desktop 根目录配置失败:",
            ),
            error,
          );
        }
      }

      configProtocol.requestSetConfig(config);
    } catch (error) {
      console.error(
        uiT("ui.modals.backendConfig.formValidationFailed", "表单验证失败:"),
        error,
      );
    }
  };

  // 重启服务
  const handleReload = () => {
    if (!localServer.isConnected()) {
      message.warning(
        t("ui.modals.backendConfig.connectFirst", "请先连接本地服务"),
      );
      return;
    }

    setReloading(true);
    const success = configProtocol.requestReload();
    if (!success) {
      message.error(
        t("ui.modals.backendConfig.reloadRequestFailed", "发送重载请求失败"),
      );
      setReloading(false);
    }

    // 设置超时保护
    setTimeout(() => {
      setReloading(false);
    }, 5000);
  };

  const labelStyle = { style: { minWidth: 120 } };

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SettingOutlined style={{ fontSize: 20 }} />
          <span style={{ fontSize: 18, fontWeight: 600 }}>
            {t("ui.modals.backendConfig.title", "LocalBridge 配置")}
          </span>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={650}
      footer={[
        <Button
          key="reload"
          icon={<ReloadOutlined />}
          onClick={handleReload}
          loading={reloading}
          style={{ float: "left" }}
        >
          {t("ui.modals.backendConfig.restartService", "重启服务")}
        </Button>,
        <Space key="actions">
          <Tooltip
            title={t(
              "ui.modals.backendConfig.reloadConfigTooltip",
              "重新加载配置",
            )}
          >
            <Button
              icon={<ReloadOutlined />}
              onClick={loadConfig}
              loading={loading}
            >
              {t("ui.modals.backendConfig.refresh", "刷新")}
            </Button>
          </Tooltip>
          <Button onClick={onClose}>
            {t("ui.modals.backendConfig.cancel", "取消")}
          </Button>
          <Button type="primary" onClick={handleSave} loading={saving}>
            {t("ui.modals.backendConfig.save", "保存配置")}
          </Button>
        </Space>,
      ]}
      styles={{
        body: {
          maxHeight: "70vh",
          overflowY: "auto",
          padding: "24px",
        },
      }}
    >
      <Spin spinning={loading}>
        {configPath && (
          <div style={{ marginBottom: 16, color: "#8c8c8c", fontSize: 12 }}>
            <FolderOutlined />{" "}
            {t("ui.modals.backendConfig.configFile", "配置文件：{{path}}", {
              path: configPath,
            })}
          </div>
        )}

        <Form
          form={form}
          layout="horizontal"
          labelCol={{ span: 6 }}
          wrapperCol={{ span: 18 }}
        >
          {/* 服务器配置 */}
          <Divider orientation="left" plain>
            {t("ui.modals.backendConfig.serverSection", "服务器配置")}
          </Divider>

          <Form.Item
            name="server_port"
            label={
              <span>
                {t("ui.modals.backendConfig.listenPort", "监听端口")}
                <Tooltip
                  title={t(
                    "ui.modals.backendConfig.listenPortTooltip",
                    "WebSocket 监听端口，修改后需重启服务",
                  )}
                >
                  <InfoCircleOutlined
                    style={{ marginLeft: 4, color: "#8c8c8c" }}
                  />
                </Tooltip>
              </span>
            }
            rules={[
              {
                required: true,
                message: t(
                  "ui.modals.backendConfig.portRequired",
                  "请输入端口号",
                ),
              },
            ]}
          >
            <InputNumber min={1} max={65535} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="server_host"
            label={t("ui.modals.backendConfig.host", "主机")}
            rules={[
              {
                required: true,
                message: t(
                  "ui.modals.backendConfig.hostRequired",
                  "请输入主机地址",
                ),
              },
            ]}
          >
            <Input placeholder="localhost" />
          </Form.Item>

          {/* 文件配置 */}
          <Divider orientation="left" plain>
            {t("ui.modals.backendConfig.fileSection", "文件配置")}
          </Divider>

          <Form.Item
            name="file_root"
            label={
              <span>
                {t("ui.modals.backendConfig.rootDir", "根目录")}
                <Tooltip
                  title={t(
                    "ui.modals.backendConfig.rootDirTooltip",
                    "文件扫描的根目录路径，修改后需重启服务。仅在 LocalBridge 指定了配置文件或 Desktop 环境中生效。",
                  )}
                >
                  <InfoCircleOutlined
                    style={{ marginLeft: 4, color: "#8c8c8c" }}
                  />
                </Tooltip>
              </span>
            }
            extra={t(
              "ui.modals.backendConfig.rootDirExtra",
              "仅在 LB 指定了配置文件（--config）或在 Desktop 环境中生效。",
            )}
          >
            <Input
              placeholder={t(
                "ui.modals.backendConfig.rootDirPlaceholder",
                "文件扫描根目录",
              )}
            />
          </Form.Item>

          <Form.Item
            name="file_exclude"
            label={
              <span>
                {t("ui.modals.backendConfig.excludeDirs", "排除目录")}
                <Tooltip
                  title={t(
                    "ui.modals.backendConfig.excludeDirsTooltip",
                    "多个目录用逗号分隔",
                  )}
                >
                  <InfoCircleOutlined
                    style={{ marginLeft: 4, color: "#8c8c8c" }}
                  />
                </Tooltip>
              </span>
            }
          >
            <Input placeholder="node_modules, .git, dist" />
          </Form.Item>

          <Form.Item
            name="file_extensions"
            label={
              <span>
                {t("ui.modals.backendConfig.fileExtensions", "文件类型")}
                <Tooltip
                  title={t(
                    "ui.modals.backendConfig.fileExtensionsTooltip",
                    "多个扩展名用逗号分隔",
                  )}
                >
                  <InfoCircleOutlined
                    style={{ marginLeft: 4, color: "#8c8c8c" }}
                  />
                </Tooltip>
              </span>
            }
          >
            <Input placeholder=".json, .jsonc" />
          </Form.Item>

          <Form.Item
            name="file_max_depth"
            label={
              <span>
                {t("ui.modals.backendConfig.maxDepth", "最大扫描深度")}
                <Tooltip
                  title={t(
                    "ui.modals.backendConfig.maxDepthTooltip",
                    "目录扫描的最大深度，0 表示无限制",
                  )}
                >
                  <InfoCircleOutlined
                    style={{ marginLeft: 4, color: "#8c8c8c" }}
                  />
                </Tooltip>
              </span>
            }
          >
            <InputNumber min={0} style={{ width: "100%" }} placeholder="10" />
          </Form.Item>

          <Form.Item
            name="file_max_files"
            label={
              <span>
                {t("ui.modals.backendConfig.maxFiles", "最大文件数量")}
                <Tooltip
                  title={t(
                    "ui.modals.backendConfig.maxFilesTooltip",
                    "扫描的最大文件数量，0 表示无限制",
                  )}
                >
                  <InfoCircleOutlined
                    style={{ marginLeft: 4, color: "#8c8c8c" }}
                  />
                </Tooltip>
              </span>
            }
          >
            <InputNumber
              min={0}
              style={{ width: "100%" }}
              placeholder="10000"
            />
          </Form.Item>

          {/* 日志配置 */}
          <Divider orientation="left" plain>
            {t("ui.modals.backendConfig.logSection", "日志配置")}
          </Divider>

          <Form.Item
            name="log_level"
            label={t("ui.modals.backendConfig.logLevel", "日志级别")}
          >
            <Select
              options={[
                { label: "DEBUG", value: "DEBUG" },
                { label: "INFO", value: "INFO" },
                { label: "WARN", value: "WARN" },
                { label: "ERROR", value: "ERROR" },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="log_dir"
            label={t("ui.modals.backendConfig.logDir", "日志目录")}
          >
            <Input
              placeholder={t(
                "ui.modals.backendConfig.logDirPlaceholder",
                "日志输出目录",
              )}
            />
          </Form.Item>

          <Form.Item
            name="log_push_to_client"
            label={t("ui.modals.backendConfig.pushLogs", "推送日志")}
            valuePropName="checked"
          >
            <Switch
              checkedChildren={t("ui.modals.backendConfig.switchOn", "开启")}
              unCheckedChildren={t(
                "ui.modals.backendConfig.switchOff",
                "关闭",
              )}
            />
          </Form.Item>

          {/* MaaFramework 配置 */}
          <Divider orientation="left" plain>
            {t("ui.modals.backendConfig.maafwSection", "MaaFramework 配置")}
          </Divider>

          <Form.Item
            name="maafw_enabled"
            label={t("ui.modals.backendConfig.enableMaafw", "启用 MaaFW")}
            valuePropName="checked"
          >
            <Switch
              checkedChildren={t(
                "ui.modals.backendConfig.switchEnabled",
                "启用",
              )}
              unCheckedChildren={t(
                "ui.modals.backendConfig.switchDisabled",
                "禁用",
              )}
            />
          </Form.Item>

          <Form.Item
            name="maafw_lib_dir"
            label={
              <span>
                {t("ui.modals.backendConfig.libDir", "Lib 目录")}
                <Tooltip
                  title={t(
                    "ui.modals.backendConfig.libDirTooltip",
                    "MaaFramework Release 包的 bin 目录路径",
                  )}
                >
                  <InfoCircleOutlined
                    style={{ marginLeft: 4, color: "#8c8c8c" }}
                  />
                </Tooltip>
              </span>
            }
          >
            <Input
              placeholder={t(
                "ui.modals.backendConfig.libDirPlaceholder",
                "MaaFramework bin 目录路径",
              )}
            />
          </Form.Item>

          <Form.Item
            name="maafw_resource_dir"
            label={
              <span>
                {t("ui.modals.backendConfig.ocrResourceDir", "OCR 资源目录")}
                <Tooltip
                  title={t(
                    "ui.modals.backendConfig.ocrResourceDirTooltip",
                    "仅用于获取 OCR 辅助，需指定包含 OCR 的资源目录（包含 pipeline、model 等文件夹的目录，一般在 /resource 或 /base 文件夹）。可不含具体 pipeline，也不会检索；指定 pipeline 检索目录请配置根目录。",
                  )}
                >
                  <InfoCircleOutlined
                    style={{ marginLeft: 4, color: "#8c8c8c" }}
                  />
                </Tooltip>
              </span>
            }
          >
            <Input
              placeholder={t(
                "ui.modals.backendConfig.ocrResourceDirPlaceholder",
                "OCR 资源目录路径",
              )}
            />
          </Form.Item>
        </Form>

        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: "#f5f5f5",
            borderRadius: 6,
            fontSize: 12,
            color: "#8c8c8c",
          }}
        >
          <InfoCircleOutlined style={{ marginRight: 4 }} />
          {t(
            "ui.modals.backendConfig.footerHint",
            "提示：部分配置（如端口、根目录）修改后需要重启后端服务才能生效",
          )}
        </div>
      </Spin>
    </Modal>
  );
};

export default BackendConfigModal;
