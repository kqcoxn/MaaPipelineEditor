import { XMarkdown } from "@ant-design/x-markdown";
import { useState, type CSSProperties } from "react";
import { Alert, Button, Empty, Typography, Splitter, theme } from "antd";
import { AimOutlined, ReloadOutlined } from "@ant-design/icons";
import { useShallow } from "zustand/shallow";
import { useWSStore } from "@/stores/connection/wsStore";
import { message } from "@/utils/ui/antdAppApi";
import { taskUnavailableReason } from "./projectInterfaceState";
import { useProjectInterfaceStore } from "./projectInterfaceStore";
import { ProjectInterfaceOptions } from "./ProjectInterfaceOptions";
import { ProjectTaskList } from "./ProjectTaskList";
import { InterfaceMonitor } from "./InterfaceMonitor";
import { InterfaceRunControls } from "./InterfaceRunControls";
import { ProjectHomeHeader } from "./ProjectHomeHeader";
import { ProjectTaskNavigation } from "./ProjectTaskNavigation";
import styles from "./ProjectHome.module.less";

const { Text, Title, Paragraph } = Typography;

export function ProjectHome() {
  const { token } = theme.useToken();
  const [filter, setFilter] = useState({ projectId: "", group: "" });
  const connected = useWSStore(s => s.connected);
  const state = useProjectInterfaceStore(useShallow(s => ({ snapshot: s.snapshot, status: s.status, preferences: s.preferences, context: s.contexts.home, notice: s.notice })));
  const { snapshot, status, preferences, context } = state;
  const tasks = snapshot?.document.task ?? [];
  const group = filter.projectId === snapshot?.projectId && snapshot?.document.group?.some(item => item.name === filter.group) ? filter.group : "";
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
    "--pi-subtle": token.colorFillQuaternary, "--pi-success": token.colorSuccessText, "--pi-error": token.colorErrorText,
  } as CSSProperties}>
    <ProjectHomeHeader snapshot={snapshot} status={status} connected={connected} />
    {(state.notice || diagnostics.length > 0) && <div className={styles.summary}>
      {state.notice && <Alert type="info" title={state.notice} showIcon />}
      {diagnostics.length > 0 && <details><summary>项目诊断（{diagnostics.length}）</summary>{diagnostics.map((item, index) => <Paragraph key={index} type={item.severity === "error" ? "danger" : "secondary"} copyable>{item.message}{item.file ? ` · ${item.file}${item.line ? `:${item.line}:${item.column ?? 1}` : ""}` : ""}</Paragraph>)}</details>}
    </div>}
    <div className={styles.body}>
    <Splitter className={styles.columns} styles={{ panel: { overflow: "hidden" } }}>
      {!snapshot ? <Splitter.Panel min={320}><div className={`${styles.empty} ${styles.projectUnavailable}`}><Empty description={!connected ? "连接 LocalBridge 后可以读取项目任务。" : status?.state === "multiple" ? "发现多个 PI，请在项目连接配置中指定入口。" : status?.state === "invalid" ? "PI 无效，请根据项目诊断修复源文件。" : status?.state === "not_found" ? "未发现 interface.json，请检查工作目录或指定 PI 入口。" : "正在读取项目…"} />{status?.candidates?.map(path => <Paragraph key={path} copyable>{path}</Paragraph>)}</div></Splitter.Panel>
      : tasks.length === 0 ? <Splitter.Panel min={320}><div className={`${styles.empty} ${styles.projectUnavailable}`}><Empty description="项目尚未声明任务" /></div></Splitter.Panel>
      : [
      <Splitter.Panel key="navigation" defaultSize="13.57%" min={130}>
      <ProjectTaskNavigation group={group} onGroupChange={group => setFilter({ projectId: snapshot.projectId, group })} />
      </Splitter.Panel>,
      <Splitter.Panel key="tasks" defaultSize="34.17%" min={260}>
      <ProjectTaskList group={group} />
      </Splitter.Panel>,
      <Splitter.Panel key="configuration" defaultSize="34.17%" min={280}>
      <article className={styles.detail}>
        <div className={styles.detailContent}>
          {selected && <>
            <header className={styles.taskHeader}>
              <div><Title level={4} style={{ margin: 0 }}>{selected.label ?? selected.name}</Title><Text type="secondary">任务配置</Text></div>
              <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => useProjectInterfaceStore.getState().resetTask()}>恢复默认</Button>
            </header>
            {selected.description && <details key={`${snapshot.projectId}:${selected.name}`} className={styles.descriptionSection}>
              <summary>任务说明</summary>
              <XMarkdown content={selected.description} className={styles.description} openLinksInNewTab escapeRawHtml />
            </details>}
            {unavailable && <Alert type="warning" title={unavailable} showIcon />}
            {context.error && <Alert type="error" title={context.error} showIcon />}
            {context.pending && context.plan?.taskName !== selected.name && <Text type="secondary">正在解析任务配置…</Text>}
            <section aria-label="任务配置">
              <ProjectInterfaceOptions plan={context.plan?.taskName === selected.name ? context.plan : undefined} channel="home" />
            </section>
          </>}
          {!selected && <Empty description="选择任务以查看说明与配置" />}
        </div>
        <footer className={styles.actions}>
          <Text type="secondary">{selected?.entry ? `入口：${selected.entry}` : "请选择任务"}</Text>
          <Button type="text" size="small" icon={<AimOutlined />} disabled={!selected || Boolean(unavailable)} onClick={() => void locate()}>在画布中查看</Button>
        </footer>
      </article>
      </Splitter.Panel>
      ]}
      <Splitter.Panel defaultSize="18.09%" min={240}>
      <InterfaceMonitor />
      </Splitter.Panel>
    </Splitter>
    </div>
    <InterfaceRunControls />
  </section>;
}
