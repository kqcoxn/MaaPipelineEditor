import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "antd";
import { CheckOutlined, CloseOutlined, DownOutlined, StopOutlined } from "@ant-design/icons";
import { useDebugSessionStore } from "@/stores/debug/debugSessionStore";
import { useDebugTraceStore } from "@/stores/debug/debugTraceStore";
import { useDebugActivity } from "@/features/debug/hooks/useDebugActivity";
import { useDebugIslandSummary } from "@/features/debug/hooks/useDebugIslandSummary";
import { activityDuration, presentDebugActivity } from "@/features/debug/selectors/debugActivityPresentation";
import type { DebugRunStarted } from "@/features/debug/types";
import { DebugRunIslandDetails } from "./DebugRunIslandDetails";
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
  const [expanded, setExpanded] = useState(false);
  const [visualExpanded, setVisualExpanded] = useState(false);
  const [detailsMounted, setDetailsMounted] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [stopStartedAt, setStopStartedAt] = useState<number>();
  const detailsId = useId();

  useEffect(() => {
    setStopStartedAt(stopping ? performance.now() : undefined);
  }, [stopping]);

  useEffect(() => {
    if (expanded) {
      setDetailsMounted(true);
      // 先让内容以收起姿态完成布局，再同步舒展轮廓和内容。
      let revealFrame = 0;
      const mountFrame = requestAnimationFrame(() => {
        revealFrame = requestAnimationFrame(() => setVisualExpanded(true));
      });
      return () => {
        cancelAnimationFrame(mountFrame);
        cancelAnimationFrame(revealFrame);
      };
    }
    setVisualExpanded(false);
    // 收拢轮廓后再卸载内容，避免动画中途高度突然归零。
    const timer = setTimeout(() => setDetailsMounted(false), 500);
    return () => clearTimeout(timer);
  }, [expanded]);

  useEffect(() => {
    setExiting(false);
    if (!terminal || hovered || focused || expanded) return;
    const duration = 5000;
    const exitTimer = setTimeout(() => setExiting(true), duration);
    const hideTimer = setTimeout(() => setHidden(true), duration + 480);
    return () => { clearTimeout(exitTimer); clearTimeout(hideTimer); };
  }, [terminal, status, hovered, focused, expanded]);

  const title = terminal
    ? { completed: "已完成", failed: "执行失败", stopped: "已停止" }[status as "completed" | "failed" | "stopped"]
    : stopping ? "正在停止…" : status === "preparing" ? "正在准备" : view.title;
  const subtitle = terminal
    ? traceSession?.failure?.message ?? `总耗时 ${activityDuration(Date.parse(run.startedAt), now)} · 点击查看运行详情`
    : stopping
      ? `等待当前操作结束 · ${activityDuration(stopStartedAt, performance.now())}`
      : view.subtitle;

  const summary = useDebugIslandSummary({
    key: `${title}:${view.owner}:${view.operation?.id ?? view.phase}`,
    title,
    owner: view.owner,
    subtitle,
  }, terminal || stopping || status === "preparing");

  const canvas = document.getElementById("mpe-main-canvas");
  if (!canvas || hidden || !["preparing", "running", "stopping", "completed", "failed", "stopped"].includes(status)) return null;

  return createPortal(
    <div className={styles.position}>
      <div className={styles.island} data-exiting={exiting} data-expanded={expanded && visualExpanded}
        data-terminal={terminal} data-failed={status === "failed"} data-hovered={hovered}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
        }}>
        <div className={styles.main}>
          <button className={styles.details} type="button" onClick={() => openModal("overview")}
            title="打开调试面板" aria-label="打开调试面板">
            <span className={styles.indicator} aria-hidden="true">
              {terminal ? (status === "failed" ? <CloseOutlined /> : status === "stopped" ? <StopOutlined /> : <CheckOutlined />)
                : <span className={styles.pulse}><i /><i /><i /></span>}
            </span>
            <span className={styles.copy}>
              <span className={styles.headline}>
                <span className={styles.status} role="status">{summary.title}</span>
                <span className={styles.owner} title={summary.owner}>{summary.owner}</span>
              </span>
              <span className={styles.node} title={summary.subtitle}>{summary.subtitle}</span>
            </span>
          </button>
          {!terminal && <Button danger type="primary" shape="round" icon={<StopOutlined />} loading={stopping}
            disabled={stopping || status !== "running"} onClick={onStop} className={styles.stop}>
            {stopping ? "停止中" : "停止"}
          </Button>}
          <button className={styles.expandButton} type="button" aria-expanded={expanded}
            aria-controls={detailsId} aria-label={expanded ? "收起当前阶段详情" : "展开当前阶段详情"}
            onClick={() => setExpanded(!expanded)}>
            <DownOutlined className={styles.chevron} />
          </button>
        </div>
        <div className={styles.expansion} data-open={expanded && visualExpanded} id={detailsId} inert={!expanded} aria-hidden={!expanded}>
          <div className={styles.expansionInner}>
            {(expanded || detailsMounted) && <DebugRunIslandDetails activity={activity} run={run} now={now} terminal={terminal} failure={traceSession?.failure?.message} />}
          </div>
        </div>
      </div>
    </div>, canvas,
  );
}
