import styles from "./BackendConfigPanel.module.less";
import { Form, Button, Spin, Alert } from "antd";
import { ReloadOutlined, FolderOutlined } from "@ant-design/icons";
import { useEffect, useState, useCallback } from "react";
import { configProtocol, interfaceProtocol } from "@/services/server";
import { useWSStore } from "@/stores/connection/wsStore";
import { useBackendConfigRequests } from "./useBackendConfigRequests";
import { BackendConfigFields } from "./BackendConfigFields";
import type { ProjectInterfaceStatus } from "@/features/project-interface/types";
import type { BackendConfig, BackendRuntimeConfig, ConfigResponse } from "@/services/protocols/ConfigProtocol";

export default function BackendConfigPanel() {
  const connected = useWSStore(state => state.connected);
  const [form] = Form.useForm();
  const { loading, saving, reloading, startRequest, finishRequest } = useBackendConfigRequests(connected);
  const [loaded, setLoaded] = useState(false);
  const [configPath, setConfigPath] = useState("");
  const [runtimeConfig, setRuntimeConfig] = useState<BackendRuntimeConfig>();
  const [interfaceStatus, setInterfaceStatus] = useState<ProjectInterfaceStatus>();

  // 加载配置
  const loadConfig = useCallback(() => {
    startRequest("loading", () => configProtocol.requestGetConfig());
  }, [startRequest]);

  // 处理配置数据
  useEffect(() => {
    if (!connected) return;

    const unsubscribe = configProtocol.onConfigData((data: ConfigResponse) => {
      finishRequest("loading");
      finishRequest("saving");

      if (data.success && data.config) {
        setLoaded(true);
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
          interface_path: data.config.interface?.path ?? "",
        });
        setConfigPath(data.config_path ?? "");
        setRuntimeConfig(data.runtime);

        // 保存成功后应用可动态重载的配置，保持表单展开。
        if (data.message) {
          startRequest("reloading", () => configProtocol.requestReload());
        }
      }
    });

    const unsubscribeInterface = interfaceProtocol.onStatus(setInterfaceStatus);

    // 进入面板或重新连接后读取当前服务配置。
    setLoaded(false);
    loadConfig();
    interfaceProtocol.requestStatus();

    return () => {
      unsubscribe();
      unsubscribeInterface();
    };
  }, [connected, form, loadConfig, startRequest, finishRequest]);

  // 监听重载响应
  useEffect(() => {
    if (!connected) return;
    const unsubscribe = configProtocol.onReload(() => {
      finishRequest("reloading");
    });

    return unsubscribe;
  }, [connected, finishRequest]);

  // 保存配置
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

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
        interface: {
          path: values.interface_path ?? "",
        },
      };

      startRequest("saving", () => configProtocol.requestSetConfig(config));
    } catch (error) {
      console.error("表单验证失败:", error);
    }
  };

  // 重载可动态应用的配置
  const handleReload = () => {
    startRequest("reloading", () => configProtocol.requestReload());
  };

  const busy = loading || saving || reloading;
  return (
    <section className={styles.panel} aria-label="后端配置">
      <h3 className={styles.title}>后端配置</h3>
      {!connected ? (
        <Alert type="info" showIcon title="连接本地服务后，可查看和修改后端配置。" />
      ) : (
        <>
          <p className={styles.description}>
            以下配置需要点击「保存配置」提交。保存后自动重载可动态应用的配置；监听地址、端口和根目录需重启 LocalBridge 生效。
          </p>
          {configPath && <div className={styles.configPath}><FolderOutlined /> 配置文件：{configPath}</div>}
          <Spin spinning={loading}>
            <Form form={form} disabled={!loaded || busy}>
              <BackendConfigFields runtimeConfig={runtimeConfig} interfaceStatus={interfaceStatus} />
            </Form>
          </Spin>
          <div className={styles.actions}>
            <Button icon={<ReloadOutlined />} onClick={handleReload} loading={reloading} disabled={busy}>重载配置</Button>
            <Button onClick={loadConfig} loading={loading} disabled={busy}>刷新配置</Button>
            <Button type="primary" onClick={handleSave} loading={saving} disabled={!loaded || busy}>保存配置</Button>
          </div>
        </>
      )}
    </section>
  );
}
