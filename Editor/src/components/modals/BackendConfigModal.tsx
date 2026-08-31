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
import { configProtocol, interfaceProtocol, localServer } from "../../services/server";
import type { ProjectInterfaceStatus } from "@/features/project-interface/types";
import type {
  BackendConfig,
  BackendRuntimeConfig,
  ConfigResponse,
} from "../../services/protocols/ConfigProtocol";
interface BackendConfigModalProps {
  open: boolean;
  onClose: () => void;
}

const rootSourceLabels: Record<BackendRuntimeConfig["root_source"], string> = {
  cli: "命令行参数",
  config: "配置文件",
  cwd: "启动工作目录",
};

const BackendConfigModal = ({ open, onClose }: BackendConfigModalProps) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [configPath, setConfigPath] = useState("");
  const [runtimeConfig, setRuntimeConfig] = useState<BackendRuntimeConfig>();
  const [interfaceStatus, setInterfaceStatus] = useState<ProjectInterfaceStatus>();

  // 加载配置
  const loadConfig = useCallback(() => {
    if (!localServer.isConnected()) {
      message.warning("请先连接本地服务");
      return;
    }

    setLoading(true);
    configProtocol.requestGetConfig();
  }, []);

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
          interface_path: data.config.interface?.path ?? "",
        });
        setConfigPath(data.config_path);
        setRuntimeConfig(data.runtime);

        // 如果是保存后的响应，自动触发重载并关闭面板
        if (data.message) {
          Modal.info({
            title: "配置已保存",
            content: (
              <div>
                <p>{data.message}</p>
                <p style={{ marginTop: 12, color: "#8c8c8c" }}>
                  已请求重载可动态应用的配置；根目录和监听地址需重启 LocalBridge
                </p>
              </div>
            ),
            okText: "知道了",
            onOk: () => {
              onClose();
            },
          });

          // 延迟500ms后自动触发重载
          setTimeout(() => {
            setReloading(true);
            const success = configProtocol.requestReload();
            if (!success) {
              message.error("自动重载失败，请手动点击重启按钮");
              setReloading(false);
            }
          }, 500);
        }
      }
    });

    const unsubscribeInterface = interfaceProtocol.onStatus(setInterfaceStatus);

    // 打开时加载配置
    loadConfig();
    interfaceProtocol.requestStatus();

    return () => {
      unsubscribe();
      unsubscribeInterface();
    };
  }, [open, form, loadConfig, onClose]);

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
        interface: {
          path: values.interface_path ?? "",
        },
      };

      configProtocol.requestSetConfig(config);
    } catch (error) {
      console.error("表单验证失败:", error);
    }
  };

  // 重启服务
  const handleReload = () => {
    if (!localServer.isConnected()) {
      message.warning("请先连接本地服务");
      return;
    }

    setReloading(true);
    const success = configProtocol.requestReload();
    if (!success) {
      message.error("发送重载请求失败");
      setReloading(false);
    }

    // 设置超时保护
    setTimeout(() => {
      setReloading(false);
    }, 5000);
  };

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SettingOutlined style={{ fontSize: 20 }} />
          <span style={{ fontSize: 18, fontWeight: 600 }}>
            LocalBridge 配置
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
          重启服务
        </Button>,
        <Space key="actions">
          <Tooltip title="重新加载配置">
            <Button
              icon={<ReloadOutlined />}
              onClick={loadConfig}
              loading={loading}
            >
              刷新
            </Button>
          </Tooltip>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSave} loading={saving}>
            保存配置
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
            <FolderOutlined /> 配置文件：{configPath}
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
            服务器配置
          </Divider>

          <Form.Item
            name="server_port"
            label={
              <span>
                监听端口
                <Tooltip title="WebSocket 监听端口，修改后需重启服务">
                  <InfoCircleOutlined
                    style={{ marginLeft: 4, color: "#8c8c8c" }}
                  />
                </Tooltip>
              </span>
            }
            rules={[{ required: true, message: "请输入端口号" }]}
          >
            <InputNumber min={1} max={65535} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="server_host"
            label="主机"
            rules={[{ required: true, message: "请输入主机地址" }]}
          >
            <Input placeholder="localhost" />
          </Form.Item>

          {/* 文件配置 */}
          <Divider orientation="left" plain>
            文件配置
          </Divider>

          <Form.Item
            name="file_root"
            label={
              <span>
                根目录
                <Tooltip title="文件扫描根目录。留空时使用 LocalBridge 的启动工作目录，修改后需重启服务。">
                  <InfoCircleOutlined
                    style={{ marginLeft: 4, color: "#8c8c8c" }}
                  />
                </Tooltip>
              </span>
            }
            extra={
              runtimeConfig ? (
                <span style={{ overflowWrap: "anywhere" }}>
                  当前使用：{runtimeConfig.file_root}（来源：
                  {rootSourceLabels[runtimeConfig.root_source]}）
                </span>
              ) : (
                "留空时使用 LocalBridge 的启动工作目录。"
              )
            }
          >
            <Input placeholder="留空时使用启动工作目录" />
          </Form.Item>

          <Form.Item
            name="file_exclude"
            label={
              <span>
                排除目录
                <Tooltip title="多个目录用逗号分隔">
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
                文件类型
                <Tooltip title="多个扩展名用逗号分隔">
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
                最大扫描深度
                <Tooltip title="目录扫描的最大深度，0 表示无限制">
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
                最大文件数量
                <Tooltip title="扫描的最大文件数量，0 表示无限制">
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
            日志配置
          </Divider>

          <Form.Item name="log_level" label="日志级别">
            <Select
              options={[
                { label: "DEBUG", value: "DEBUG" },
                { label: "INFO", value: "INFO" },
                { label: "WARN", value: "WARN" },
                { label: "ERROR", value: "ERROR" },
              ]}
            />
          </Form.Item>

          <Form.Item name="log_dir" label="日志目录">
            <Input placeholder="日志输出目录" />
          </Form.Item>

          <Form.Item
            name="log_push_to_client"
            label="推送日志"
            valuePropName="checked"
          >
            <Switch checkedChildren="开启" unCheckedChildren="关闭" />
          </Form.Item>

          {/* MaaFramework 配置 */}
          <Divider orientation="left" plain>
            MaaFramework 配置
          </Divider>

          <Form.Item
            name="maafw_enabled"
            label="启用 MaaFW"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          <Form.Item
            name="maafw_lib_dir"
            label={
              <span>
                Lib 目录
                <Tooltip title="MaaFramework Release 包的 bin 目录路径">
                  <InfoCircleOutlined
                    style={{ marginLeft: 4, color: "#8c8c8c" }}
                  />
                </Tooltip>
              </span>
            }
          >
            <Input placeholder="MaaFramework bin 目录路径" />
          </Form.Item>

          <Form.Item
            name="maafw_resource_dir"
            label={
              <span>
                OCR 资源目录
                <Tooltip title="仅用于获取 OCR 辅助，需指定包含 OCR 的资源目录（包含 pipeline、model 等文件夹的目录，一般在 /resource 或 /base 文件夹）。可不含具体 pipeline，也不会检索；指定 pipeline 检索目录请配置根目录。">
                  <InfoCircleOutlined
                    style={{ marginLeft: 4, color: "#8c8c8c" }}
                  />
                </Tooltip>
              </span>
            }
          >
            <Input placeholder="OCR 资源目录路径" />
          </Form.Item>

          <Divider orientation="left" plain>
            Project Interface
          </Divider>
          <Form.Item
            name="interface_path"
            label="入口路径"
            extra="留空时在文件根目录内自动检索；显式入口可使用根目录外的绝对路径，或相对于文件根目录的路径。"
          >
            <Input placeholder="留空自动检索，例如：../assets/interface.json" />
          </Form.Item>
          {interfaceStatus && (
            <Form.Item label="当前状态">
              <Space orientation="vertical" size={4}>
                <span>
                  {interfaceStatus.state} · {interfaceStatus.mode === "auto" ? "自动检索" : "显式入口"}
                </span>
                {interfaceStatus.effectivePath && <span>{interfaceStatus.effectivePath}</span>}
                {interfaceStatus.diagnostics?.[0] && (
                  <span style={{ color: "#cf1322" }}>{interfaceStatus.diagnostics[0].message}</span>
                )}
              </Space>
            </Form.Item>
          )}
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
          提示：部分配置（如端口、根目录）修改后需要重启后端服务才能生效
        </div>
      </Spin>
    </Modal>
  );
};

export default BackendConfigModal;
