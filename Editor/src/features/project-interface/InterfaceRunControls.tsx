import { Alert, Button, Progress, Space, Typography } from "antd";
import { PlayCircleOutlined, StopOutlined, ToolOutlined } from "@ant-design/icons";
import { useShallow } from "zustand/shallow";
import { useWSStore } from "@/stores/connection/wsStore";
import { useProjectInterfaceStore } from "./projectInterfaceStore";
import { environmentSignature, prepareInterfaceProject, startInterfaceRun, stopInterfaceRun, useInterfaceRunStore } from "./interfaceRunStore";
import { isInterfaceRunning, runStatusLabels } from "./interfaceRunTypes";
import { taskUnavailableReason } from "./projectInterfaceState";
import styles from "./ProjectHome.module.less";

export function InterfaceRunControls() {
  const { run, pending, error, preparation } = useInterfaceRunStore();
  const { snapshot, preferences } = useProjectInterfaceStore(useShallow(s => ({ snapshot: s.snapshot, preferences: s.preferences })));
  const connected = useWSStore(s => s.connected);
  const active = isInterfaceRunning(run?.status);
  const programs = Array.isArray(snapshot?.document.pretask) ? snapshot.document.pretask : snapshot?.document.pretask ? [snapshot.document.pretask] : [];
  const hasPretasks = programs.some(program => !taskUnavailableReason(program, preferences.controllerName, preferences.resourceName));
  const prepared = preparation?.signature === environmentSignature();
  const completed = run?.items.filter(item => item.status === "completed").length ?? 0;
  const current = run?.items.find(item => item.status === "running");
  return <div className={styles.runControls}>
    {error && <Alert type="error" title={error} showIcon closable={{ onClose: () => useInterfaceRunStore.setState({ error: undefined }) }} />}
    <footer className={styles.runFooter}>
      <div className={styles.runSummary} aria-live="polite">
        <Typography.Text strong>{active ? current ? `正在执行 · ${current.label}` : runStatusLabels[run!.status] : run?.runId ? runStatusLabels[run.status] : "准备就绪"}</Typography.Text>
        <Typography.Text type="secondary">{active ? `${run?.controllerName} / ${run?.resourceName} · 修改配置将在下次运行生效` : `已勾选 ${preferences.checkedTaskNames?.length ?? 0} 个任务 · 使用磁盘上已保存的项目资源`}</Typography.Text>
        {run?.items.length ? <Progress size="small" percent={Math.round(completed / run.items.length * 100)} status={run.status === "failed" ? "exception" : active ? "active" : undefined} format={() => `${completed} / ${run.items.length}`} /> : null}
      </div>
      <Space wrap>
        {hasPretasks && <Button icon={<ToolOutlined />} loading={pending?.kind === "prepare"} disabled={!connected || active || Boolean(pending)} onClick={prepareInterfaceProject}>{prepared ? "重新准备项目" : "准备项目（连接设备前）"}</Button>}
        {active ? <Button danger icon={<StopOutlined />} loading={pending?.kind === "stop" || run?.status === "stopping"} disabled={!connected} onClick={stopInterfaceRun}>停止运行</Button>
          : <Button type="primary" icon={<PlayCircleOutlined />} loading={pending?.kind === "start"} disabled={!connected || !snapshot || Boolean(pending) || !preferences.checkedTaskNames?.length || (hasPretasks && !prepared)} onClick={startInterfaceRun}>开始运行</Button>}
      </Space>
    </footer>
  </div>;
}
