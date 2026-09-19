import { Button, Select, Space, Tag, Typography } from "antd";
import { FolderOpenOutlined, SettingOutlined } from "@ant-design/icons";
import { useShallow } from "zustand/shallow";
import { useMFWStore } from "@/stores/connection/mfwStore";
import { usePanelOccupancyStore } from "@/stores/ui/panelOccupancyStore";
import { localServer } from "@/services/server";
import { asObjectArray, compatibleResources } from "./projectInterfaceState";
import { useProjectInterfaceStore } from "./projectInterfaceStore";
import type { ProjectInterfaceSnapshot, ProjectInterfaceStatus } from "./types";
import styles from "./ProjectHome.module.less";

const { Text, Title } = Typography;

export function ProjectHomeHeader({ snapshot, status, connected, rootPath, onConfigure }: {
  snapshot?: ProjectInterfaceSnapshot;
  status?: ProjectInterfaceStatus;
  connected: boolean;
  rootPath?: string;
  onConfigure: () => void;
}) {
  const preferences = useProjectInterfaceStore(s => s.preferences);
  const device = useMFWStore(useShallow(s => ({ status: s.connectionStatus, type: s.controllerType })));
  const controllers = asObjectArray(snapshot?.document.controller);
  const resources = compatibleResources(asObjectArray(snapshot?.document.resource), preferences.controllerName);
  const path = snapshot?.entryPath ?? status?.effectivePath ?? rootPath ?? "";

  return <div className={styles.projectOverview}>
    <header className={styles.header}>
      <div className={styles.projectIdentity}>
        <div className={styles.projectTitle}>
          <Title level={4} style={{ margin: 0 }}>{String(snapshot?.document.label ?? snapshot?.document.name ?? "项目首页")}</Title>
          {snapshot?.document.version ? <Text type="secondary">{String(snapshot.document.version)}</Text> : null}
          <Tag color={connected && status?.state === "ready" ? "success" : "default"}>
            {connected ? status?.state === "ready" ? "PI 已加载" : "PI 待配置" : "LocalBridge 未连接"}
          </Tag>
        </div>
        {path ? <div className={styles.projectPath}>
          <FolderOpenOutlined aria-hidden="true" />
          <Text type="secondary" ellipsis title={path} copyable={{ text: path }}>{path}</Text>
        </div> : <Text type="secondary">连接本地项目以浏览 PI 任务</Text>}
      </div>
      <Button icon={<SettingOutlined />} onClick={() => connected ? onConfigure() : localServer.connect()}>
        {connected ? "项目连接配置" : "连接 LocalBridge"}
      </Button>
    </header>
    {snapshot && <div className={styles.environment} aria-label="运行环境">
      <span className={styles.environmentTitle}>运行环境</span>
      <div className={styles.environmentField}>
        <label htmlFor="pi-home-controller">控制器</label>
        <Select id="pi-home-controller" aria-label="PI 控制器" className={styles.environmentSelect}
          value={preferences.controllerName || undefined}
          onChange={useProjectInterfaceStore.getState().setControllerName}
          options={controllers.map(item => ({ value: String(item.name), label: String(item.label ?? item.name) }))} />
      </div>
      <div className={styles.environmentField}>
        <label htmlFor="pi-home-resource">资源</label>
        <Select id="pi-home-resource" aria-label="PI 资源" className={styles.environmentSelect}
          value={preferences.resourceName || undefined}
          onChange={useProjectInterfaceStore.getState().setResourceName}
          options={resources.map(item => ({ value: String(item.name), label: String(item.label ?? item.name) }))} />
      </div>
      <Space className={styles.device} wrap size={12}>
        <Text type={device.status === "connected" ? "success" : "secondary"}>
          {device.status === "connected" ? `设备已连接 · ${device.type}` : "设备未连接"}
        </Text>
        <Button onClick={() => usePanelOccupancyStore.getState().activate("connection")}>设备配置</Button>
      </Space>
    </div>}
  </div>;
}
