import { Select, Tag, Typography } from "antd";
import { asObjectArray, compatibleResources } from "./projectInterfaceState";
import { useProjectInterfaceStore } from "./projectInterfaceStore";
import type { ProjectInterfaceSnapshot, ProjectInterfaceStatus } from "./types";
import styles from "./ProjectHome.module.less";

const { Text, Title } = Typography;

export function ProjectHomeHeader({ snapshot, status, connected }: {
  snapshot?: ProjectInterfaceSnapshot;
  status?: ProjectInterfaceStatus;
  connected: boolean;
}) {
  const preferences = useProjectInterfaceStore(s => s.preferences);
  const resources = compatibleResources(asObjectArray(snapshot?.document.resource), preferences.controllerName);


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
      </div>
    {snapshot && <div className={styles.environment} aria-label="运行环境">
      <div className={styles.environmentField}>
        <label htmlFor="pi-home-resource">资源</label>
        <Select id="pi-home-resource" aria-label="PI 资源" className={styles.environmentSelect}
          value={preferences.resourceName || undefined}
          onChange={useProjectInterfaceStore.getState().setResourceName}
          options={resources.map(item => ({ value: String(item.name), label: String(item.label ?? item.name) }))} />
      </div>
    </div>}
    </header>
  </div>;
}
