import { useEffect, useState } from "react";
import { Button } from "antd";
import { CheckOutlined, CloseOutlined, StopOutlined } from "@ant-design/icons";
import { useDebugSessionStore } from "@/stores/debug/debugSessionStore";
import { useDebugTraceStore } from "@/stores/debug/debugTraceStore";
import { useDebugActivity } from "@/features/debug/hooks/useDebugActivity";
import { useDebugIslandSummary } from "@/features/debug/hooks/useDebugIslandSummary";
import { activityDuration, presentDebugActivity } from "@/features/debug/selectors/debugActivityPresentation";
import type { DebugRunStarted } from "@/features/debug/types";
import { Island } from "@/components/island";
import { DebugRunIslandDetails } from "./DebugRunIslandDetails";
import { desktopContext, desktopInvoke } from "@/features/desktop/host";
import { message, modal } from "@/utils/ui/antdAppApi";
import styles from "./DebugRunIsland.module.less";

interface DebugRunIslandProps {
  stopPending: boolean;
  onStop: () => void;
}

export function DebugRunIsland(props: DebugRunIslandProps) {
  const run = useDebugSessionStore((state) => state.activeRun);
  const session = useDebugSessionStore((state) => state.session);
  if (!run || run.mode === "replay" || session?.sessionId !== run.sessionId) return null;
  return <DebugRunIslandContent key={`${run.sessionId}:${run.runId}`} {...props} run={run} status={session.status} />;
}

function DebugRunIslandContent({ run, status: sessionStatus, stopPending, onStop }: DebugRunIslandProps & {
  run: DebugRunStarted;
  status: string;
}) {
  const traceSession = useDebugTraceStore((state) => state.displaySessions.find(
    (item) => item.sessionId === run.sessionId && item.runId === run.runId,
  ));
  const status = traceSession?.status && ["completed", "failed", "stopped"].includes(traceSession.status)
    ? traceSession.status : sessionStatus;
  const terminal = ["completed", "failed", "stopped"].includes(status);
  const stopping = !terminal && (stopPending || status === "stopping");
  const openModal = useDebugSessionStore((state) => state.openModal);
  const { activity, now } = useDebugActivity(run, terminal);
  const view = presentDebugActivity(activity, run, now);
  const [stopStartedAt, setStopStartedAt] = useState<number>();

  useEffect(() => {
    setStopStartedAt(stopping ? performance.now() : undefined);
  }, [stopping]);

  const stopOverdue = stopping && stopStartedAt !== undefined && performance.now() - stopStartedAt >= 10_000;
  const recover = () => {
    if (desktopContext) {
      void desktopInvoke("desktop_open_recovery").catch((error) => message.error(String(error)));
    } else {
      modal.info({
        title: "停止尚未完成",
        content: "当前操作尚未退出。请先保存文件并导出诊断日志，再在运行 LocalBridge 的终端结束并重新启动服务，随后重新连接。",
      });
    }
  };

  const title = terminal
    ? { completed: "已完成", failed: "执行失败", stopped: "已停止" }[status as "completed" | "failed" | "stopped"]
    : stopOverdue ? "停止尚未完成" : stopping ? "正在停止…" : status === "preparing" ? "正在准备" : view.title;
  const subtitle = terminal
    ? traceSession?.failure?.message ?? `总耗时 ${activityDuration(Date.parse(run.startedAt), now)} · 点击查看运行详情`
    : stopOverdue
      ? "当前操作未退出 · 请先保存文件、导出日志，再恢复服务"
    : stopping
      ? `等待当前操作结束 · ${activityDuration(stopStartedAt, performance.now())}`
      : view.subtitle;

  const summary = useDebugIslandSummary({
    key: `${title}:${view.owner}:${view.operation?.id ?? view.phase}`,
    title,
    owner: view.owner,
    subtitle,
  }, terminal || stopping || status === "preparing");

  if (!["preparing", "running", "stopping", "completed", "failed", "stopped"].includes(status)) return null;

  return (
    <Island
      islandKey={`${run.sessionId}:${run.runId}`}
      tone={status === "failed" ? "danger" : undefined}
      data={{ terminal }}
      indicator={
        terminal
          ? (status === "failed" ? <CloseOutlined /> : status === "stopped" ? <StopOutlined /> : <CheckOutlined />)
          : <span className={styles.pulse}><i /><i /><i /></span>
      }
      summary={{
        title: summary.title,
        owner: summary.owner,
        subtitle: summary.subtitle,
      }}
      onOpen={() => openModal("overview")}
      openLabel="打开调试面板"
      actions={!terminal ? stopOverdue ? [{
        key: "recover",
        node: <Button danger shape="round" onClick={recover}>{desktopContext ? "打开环境管理" : "恢复指引"}</Button>,
      }] : [{
        key: "stop",
        node: (
          <Button
            danger
            type="primary"
            shape="round"
            icon={<StopOutlined />}
            loading={stopping}
            disabled={stopping || status !== "running"}
            onClick={onStop}
            className={styles.stop}
          >
            {stopping ? "停止中" : "停止"}
          </Button>
        ),
      }] : undefined}
      expandable
      expandLabel="展开当前阶段详情"
      collapseLabel="收起当前阶段详情"
      details={
        <DebugRunIslandDetails
          activity={activity}
          run={run}
          now={now}
          terminal={terminal}
          failure={traceSession?.failure?.message}
        />
      }
      autoHide={{
        enabled: terminal,
        durationMs: 5000,
        pauseWhenExpanded: true,
      }}
    />
  );
}
