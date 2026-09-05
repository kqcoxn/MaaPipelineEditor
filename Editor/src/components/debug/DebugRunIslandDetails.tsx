import { activityDuration, presentDebugActivity } from "@/features/debug/selectors/debugActivityPresentation";
import type { DebugActivity } from "@/features/debug/state/debugActivityTypes";
import type { DebugRunStarted } from "@/features/debug/types";
import { getRunModeLabel } from "@/features/debug/utils/capabilityLabels";
import styles from "./DebugRunIsland.module.less";

export function DebugRunIslandDetails({ activity, run, now, terminal, failure }: {
  activity: DebugActivity;
  run: DebugRunStarted;
  now: number;
  terminal: boolean;
  failure?: string;
}) {
  const view = presentDebugActivity(activity, run, now);
  return (
    <div className={styles.expandedContent}>
      {failure && <p className={styles.failure}>{failure}</p>}
      {view.focus && <p className={styles.focusMessage}>{view.focus}</p>}
      <dl className={styles.metrics}>
        {view.rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
      </dl>
      {view.search && <>
        <div className={styles.sectionLabel}>本轮候选</div>
        <ul className={styles.candidates}>
          {view.search.candidates.map((candidate, index) => (
            <li key={index} data-state={candidate.status}>
              <span title={candidate.name}>{candidate.anchor ? "[Anchor] " : ""}{candidate.name}{candidate.jumpBack ? " ↩" : ""}</span>
              <span>
                {{ pending: "未观测到识别", running: terminal ? "未收到结果" : "识别中", hit: "已命中", miss: "未命中" }[candidate.status]}
                {candidate.startedAt !== undefined && ` · ${activityDuration(candidate.startedAt, candidate.endedAt ?? now)}`}
              </span>
            </li>
          ))}
        </ul>
      </>}
      <div className={styles.footer}>
        <span>{getRunModeLabel(run.mode)}</span>
        <span>总耗时 {activityDuration(Date.parse(run.startedAt), now)}</span>
      </div>
      {terminal && <div className={styles.totals}>
        扫描 {activity.totalRounds} 轮 · 识别 {activity.recognitionCount} 次 · 动作 {activity.actionCount} 次
      </div>}
    </div>
  );
}
