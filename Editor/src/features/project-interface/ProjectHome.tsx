import { useState, type CSSProperties } from "react";
import { Alert, Button, Empty, Typography, theme } from "antd";
import { AimOutlined, ReloadOutlined, FileTextOutlined } from "@ant-design/icons";
import { useShallow } from "zustand/shallow";
import BackendConfigModal from "@/components/modals/BackendConfigModal";
import { useWSStore } from "@/stores/connection/wsStore";
import { useLocalFileStore } from "@/stores/project/localFileStore";
import { message } from "@/utils/ui/antdAppApi";
import { taskUnavailableReason } from "./projectInterfaceState";
import { useProjectInterfaceStore } from "./projectInterfaceStore";
import { ProjectInterfaceOptions } from "./ProjectInterfaceOptions";
import { ProjectTaskList } from "./ProjectTaskList";
import { InterfaceMonitor } from "./InterfaceMonitor";
import { InterfaceRunControls } from "./InterfaceRunControls";
import { ProjectHomeHeader } from "./ProjectHomeHeader";
import styles from "./ProjectHome.module.less";

const { Text, Title, Paragraph } = Typography;

export function ProjectHome() {
  const { token } = theme.useToken();
  const [configOpen, setConfigOpen] = useState(false);
  const connected = useWSStore(s => s.connected);
  const rootPath = useLocalFileStore(s => s.rootPath);
  const state = useProjectInterfaceStore(useShallow(s => ({ snapshot: s.snapshot, status: s.status, preferences: s.preferences, context: s.contexts.home, notice: s.notice })));
  const { snapshot, status, preferences, context } = state;
  const tasks = snapshot?.document.task ?? [];
  const selected = tasks.find(task => task.name === preferences.taskName);
  const unavailable = selected && taskUnavailableReason(selected, preferences.controllerName, preferences.resourceName);
  const diagnostics = [...(status?.diagnostics ?? []), ...(snapshot?.diagnostics ?? []), ...(context.plan?.diagnostics ?? [])];
  const locate = async () => {
    try { const { locateProjectTask } = await import("./projectTaskActions"); await locateProjectTask(); }
    catch (error) { message.error(error instanceof Error ? error.message : "定位失败"); }
  };

  return <section className={styles.home} aria-label="项目首页" style={{
    "--pi-bg": token.colorBgLayout, "--pi-surface": token.colorBgContainer, "--pi-text": token.colorText,
    "--pi-border": token.colorBorderSecondary, "--pi-hover": token.colorFillTertiary,
    "--pi-primary": token.colorPrimary, "--pi-selected": token.colorPrimaryBg, "--pi-selected-border": token.colorPrimaryBorder,
    "--pi-warning": token.colorWarningText, "--pi-muted": token.colorTextSecondary,
    "--pi-subtle": token.colorFillQuaternary,
  } as CSSProperties}>
    <ProjectHomeHeader snapshot={snapshot} status={status} connected={connected} rootPath={rootPath} onConfigure={() => setConfigOpen(true)} />
    {(state.notice || diagnostics.length > 0) && <div className={styles.summary}>
      {state.notice && <Alert type="info" title={state.notice} showIcon />}
      {diagnostics.length > 0 && <details><summary>项目诊断（{diagnostics.length}）</summary>{diagnostics.map((item, index) => <Paragraph key={index} type={item.severity === "error" ? "danger" : "secondary"} copyable>{item.message}{item.file ? ` · ${item.file}${item.line ? `:${item.line}:${item.column ?? 1}` : ""}` : ""}</Paragraph>)}</details>}
    </div>}
    <div className={styles.body}>
      {!snapshot ? <div className={`${styles.empty} ${styles.projectUnavailable}`}><Empty description={!connected ? "连接 LocalBridge 后可以读取项目任务。" : status?.state === "multiple" ? "发现多个 PI，请在项目连接配置中指定入口。" : status?.state === "invalid" ? "PI 无效，请根据项目诊断修复源文件。" : status?.state === "not_found" ? "未发现 interface.json，请检查工作目录或指定 PI 入口。" : "正在读取项目…"} />{status?.candidates?.map(path => <Paragraph key={path} copyable>{path}</Paragraph>)}</div>
      : tasks.length === 0 ? <div className={`${styles.empty} ${styles.projectUnavailable}`}><Empty description="项目尚未声明任务" /></div>
      : <>
      <ProjectTaskList />
      <article className={styles.detail}>
        <div className={styles.detailContent}>
          {selected && <>
            <header className={styles.taskHeader}>
              <div className={styles.eyebrow}>任务详情</div>
              <Title level={3} style={{ margin: 0 }}>{selected.label ?? selected.name}</Title>
              <div className={styles.taskMetadata}>
                <span><Text type="secondary">标识</Text><Text copyable>{selected.name}</Text></span>
                <span><Text type="secondary">入口</Text><Text copyable>{selected.entry}</Text></span>
              </div>
            </header>
            {selected.description && <section className={styles.description}>
              <h3><FileTextOutlined aria-hidden="true" />任务说明</h3>
              <Paragraph style={{ whiteSpace: "pre-wrap", margin: 0 }}>{selected.description}</Paragraph>
            </section>}
            {unavailable && <Alert type="warning" title={unavailable} showIcon />}
            {context.error && <Alert type="error" title={context.error} showIcon />}
            {context.pending && <Text type="secondary">正在解析任务配置…</Text>}
            <section className={styles.optionsSection} aria-label="任务配置">
              <div className={styles.sectionHeading}><h3>任务配置</h3><Text type="secondary">选项仅保存在当前浏览器</Text></div>
              <ProjectInterfaceOptions plan={context.plan?.taskName === selected.name ? context.plan : undefined} channel="home" />
            </section>
          </>}
          {!selected && <Empty description="从左侧选择一个任务" />}
        </div>
        <footer className={styles.actions}>
          <Button type="text" icon={<ReloadOutlined />} disabled={!selected} onClick={() => useProjectInterfaceStore.getState().resetTask()}>恢复任务默认选项</Button>
          <Button type="text" icon={<AimOutlined />} disabled={!selected || Boolean(unavailable)} onClick={() => void locate()}>在画布中查看</Button>
        </footer>
      </article>
      </>}
      <InterfaceMonitor />
    </div>
    <InterfaceRunControls />
    <BackendConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
  </section>;
}
