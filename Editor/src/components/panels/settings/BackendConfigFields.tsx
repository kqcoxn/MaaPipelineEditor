import { Form, Input, InputNumber, Switch, Select, Space, Tooltip } from "antd";
import type { FormItemProps } from "antd";
import styles from "./BackendConfigPanel.module.less";
import { InfoCircleOutlined } from "@ant-design/icons";
import { InterfaceEntryInput } from "@/features/project-interface/InterfaceEntryInput";
import type { ProjectInterfaceStatus } from "@/features/project-interface/types";
import type { BackendRuntimeConfig } from "@/services/protocols/ConfigProtocol";

const rootSourceLabels: Record<BackendRuntimeConfig["root_source"], string> = {
  cli: "命令行参数",
  config: "配置文件",
  cwd: "启动工作目录",
};

function ConfigField({ label, extra, children, compact, toggle, ...props }: FormItemProps & {
  compact?: boolean;
  toggle?: boolean;
}) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldRow}>
        {props.name ? (
  <label className={styles.label} htmlFor={String(props.name)}>{label}</label>
        ) : <span className={styles.label}>{label}</span>}
        <div className={toggle ? styles.toggle : compact ? styles.compact : styles.control}>
  <Form.Item {...props} style={{ marginBottom: 0 }}>{children}</Form.Item>
        </div>
      </div>
      {extra && <div className={styles.extra}>{extra}</div>}
    </div>
  );
}

export function BackendConfigFields({ runtimeConfig, interfaceStatus }: {
  runtimeConfig?: BackendRuntimeConfig;
  interfaceStatus?: ProjectInterfaceStatus;
}) {
  return <>
  {/* 服务器配置 */}
  <h4 className={styles.groupTitle}>服务器配置</h4>

  <ConfigField
    name="server_port" compact
    label={
      <span>
        监听端口
        <Tooltip title="WebSocket 监听端口，修改后需重启服务">
          <InfoCircleOutlined
            style={{ marginLeft: 4, color: "var(--ant-color-text-secondary)" }}
          />
        </Tooltip>
      </span>
    }
    rules={[{ required: true, message: "请输入端口号" }]}
  >
    <InputNumber min={1} max={65535} style={{ width: "100%" }} />
  </ConfigField>

  <ConfigField
    name="server_host"
    label="主机"
    rules={[{ required: true, message: "请输入主机地址" }]}
  >
    <Input placeholder="localhost" />
  </ConfigField>

  {/* 文件配置 */}
  <h4 className={styles.groupTitle}>文件配置</h4>

  <ConfigField
    name="file_root"
    label={
      <span>
        根目录
        <Tooltip title="文件扫描根目录。留空时使用 LocalBridge 的启动工作目录，修改后需重启服务。">
          <InfoCircleOutlined
            style={{ marginLeft: 4, color: "var(--ant-color-text-secondary)" }}
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
  </ConfigField>

  <ConfigField
    name="file_exclude"
    label={
      <span>
        排除目录
        <Tooltip title="多个目录用逗号分隔">
          <InfoCircleOutlined
            style={{ marginLeft: 4, color: "var(--ant-color-text-secondary)" }}
          />
        </Tooltip>
      </span>
    }
  >
    <Input placeholder="node_modules, .git, dist" />
  </ConfigField>

  <ConfigField
    name="file_extensions"
    label={
      <span>
        文件类型
        <Tooltip title="多个扩展名用逗号分隔">
          <InfoCircleOutlined
            style={{ marginLeft: 4, color: "var(--ant-color-text-secondary)" }}
          />
        </Tooltip>
      </span>
    }
  >
    <Input placeholder=".json, .jsonc" />
  </ConfigField>

  <ConfigField
    name="file_max_depth" compact
    label={
      <span>
        最大扫描深度
        <Tooltip title="目录扫描的最大深度，0 表示无限制">
          <InfoCircleOutlined
            style={{ marginLeft: 4, color: "var(--ant-color-text-secondary)" }}
          />
        </Tooltip>
      </span>
    }
  >
    <InputNumber min={0} style={{ width: "100%" }} placeholder="10" />
  </ConfigField>

  <ConfigField
    name="file_max_files" compact
    label={
      <span>
        最大文件数量
        <Tooltip title="扫描的最大文件数量，0 表示无限制">
          <InfoCircleOutlined
            style={{ marginLeft: 4, color: "var(--ant-color-text-secondary)" }}
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
  </ConfigField>

  {/* 日志配置 */}
  <h4 className={styles.groupTitle}>日志配置</h4>

  <ConfigField name="log_level" compact label="日志级别">
    <Select
      options={[
        { label: "DEBUG", value: "DEBUG" },
        { label: "INFO", value: "INFO" },
        { label: "WARN", value: "WARN" },
        { label: "ERROR", value: "ERROR" },
      ]}
    />
  </ConfigField>

  <ConfigField name="log_dir" label="日志目录">
    <Input placeholder="日志输出目录" />
  </ConfigField>

  <ConfigField
    name="log_push_to_client" toggle
    label="推送日志"
    valuePropName="checked"
  >
    <Switch checkedChildren="开启" unCheckedChildren="关闭" />
  </ConfigField>

  <h4 className={styles.groupTitle}>Project Interface</h4>
  <ConfigField
    name="interface_path"
    label="入口路径"
    extra="按当前运行项目的根目录独立保存，切换项目后自动切换。留空自动检索；可填写绝对路径或相对于当前项目根目录的路径。"
  >
    <InterfaceEntryInput status={interfaceStatus} rootPath={runtimeConfig?.file_root} />
  </ConfigField>
  {interfaceStatus && (
    <ConfigField label="当前状态">
      <Space orientation="vertical" size={4}>
        <span>
          {interfaceStatus.state} · {interfaceStatus.mode === "auto" ? "自动检索" : "显式入口"}
        </span>
        {interfaceStatus.effectivePath && <span>{interfaceStatus.effectivePath}</span>}
        {interfaceStatus.diagnostics?.[0] && (
          <span style={{ color: "var(--ant-color-error)" }}>{interfaceStatus.diagnostics[0].message}</span>
        )}
      </Space>
    </ConfigField>
  )}
  </>;
}
