import { useEffect, useState } from "react";
import { Alert, Button, Progress, Space, Typography } from "antd";
import { PlayCircleOutlined, StopOutlined, ToolOutlined } from "@ant-design/icons";
import { useShallow } from "zustand/shallow";
import { useWSStore } from "@/stores/connection/wsStore";
import { useProjectInterfaceStore } from "./projectInterfaceStore";
import { environmentSignature, prepareInterfaceProject, startInterfaceRun, stopInterfaceRun, useInterfaceRunStore } from "./interfaceRunStore";
import { isInterfaceRunning, runStatusLabels } from "./interfaceRunTypes";
import { taskUnavailableReason } from "./projectInterfaceState";
import styles from "./InterfaceRunControls.module.less";

export function InterfaceRunControls() {
  const { run, pending, error, preparation } = useInterfaceRunStore();
  const { snapshot, preferences } = useProjectInterfaceStore(useShallow(s => ({ snapshot: s.snapshot, preferences: s.preferences })));
  const connected = useWSStore(s => s.connected);
  const active = isInterfaceRunning(run?.status);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  const seconds = run?.startedAt ? Math.max(0, Math.floor((now - Date.parse(run.startedAt)) / 1000)) : 0;
  const elapsed = Number.isFinite(seconds) ? `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}` : "—";
  const programs = Array.isArray(snapshot?.document.pretask) ? snapshot.document.pretask : snapshot?.document.pretask ? [snapshot.document.pretask] : [];
  const hasPretasks = programs.some(program => !taskUnavailableReason(program, preferences.controllerName, preferences.resourceName));
  const prepared = preparation?.signature === environmentSignature();
  const completed = run?.items.filter(item => item.status === "completed").length ?? 0;
  const current = run?.items.find(item => item.status === "running");
  const queued = (preferences.taskOrder ?? []).filter(name => preferences.checkedTaskNames?.includes(name)).map(name => ({
    name, label: snapshot?.document.task?.find(task => task.name === name)?.label ?? name, status: "pending",
  }));
  const items = run && run.projectId === snapshot?.projectId && run.items.length ? run.items : queued;
  return <div className={styles.runControls}>
    {error && <Alert type="error" title={error} showIcon closable={{ onClose: () => useInterfaceRunStore.setState({ error: undefined }) }} />}
    <footer className={styles.runFooter}>
      <div className={styles.runSummary} aria-live="polite">
        <Typography.Text strong>{active ? current ? `正在执行 · ${current.label}` : runStatusLabels[run!.status] : run?.runId ? runStatusLabels[run.status] : "准备就绪"}</Typography.Text>
        <Typography.Text type="secondary">{active ? "修改配置将在下次运行生效" : `已勾选 ${preferences.checkedTaskNames?.length ?? 0} 个任务`}</Typography.Text>
      </div>
      <div className={styles.runProgress}>
        {run && run.projectId === snapshot?.projectId && run.items.length > 0 && <div className={styles.progressLine}>
          <span>已完成 {completed} / {run.items.length}</span>
          <Progress size="small" percent={Math.round(completed / run.items.length * 100)} status={run.status === "failed" ? "exception" : active ? "active" : "normal"} showInfo={false} />
          {active && <time>已用时 {elapsed}</time>}
        </div>}
        <details className={styles.queue} onKeyDown={event => { if (event.key === "Escape") event.currentTarget.open = false; }}
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}>
          <summary>运行队列 · {items.length} 项<span>{active ? "查看执行顺序" : "查看任务顺序"}</span></summary>
        <ol className={styles.sequence} aria-label={run && run.projectId === snapshot?.projectId && run.items.length ? "本次运行序列" : "待运行序列"}>
          {items.map((item, index) => <li key={`${item.name}:${index}`} data-status={item.status} title={`${item.label} · ${runStatusLabels[item.status] ?? item.status}`}>
            <span>{index + 1}.</span> {item.label}<small>{runStatusLabels[item.status] ?? item.status}</small>
          </li>)}
          {!items.length && <li>勾选任务以建立运行队列</li>}
        </ol>
        </details>
      </div>
      <Space wrap>
        {hasPretasks && <Button icon={<ToolOutlined />} loading={pending?.kind === "prepare"} disabled={!connected || active || Boolean(pending)} onClick={prepareInterfaceProject}>{prepared ? "重新准备项目" : "准备项目（连接设备前）"}</Button>}
        {active ? <Button danger icon={<StopOutlined />} loading={pending?.kind === "stop" || run?.status === "stopping"} disabled={!connected} onClick={stopInterfaceRun}>停止运行</Button>
          : <Button type="primary" icon={<PlayCircleOutlined />} loading={pending?.kind === "start"} disabled={!connected || !snapshot || Boolean(pending) || !preferences.checkedTaskNames?.length || (hasPretasks && !prepared)} onClick={startInterfaceRun}>开始运行</Button>}
      </Space>
    </footer>
  </div>;
}
