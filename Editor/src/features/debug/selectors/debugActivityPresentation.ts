import type { DebugActivity } from "../state/debugActivityTypes";
import type { DebugRunStarted } from "../types";

export function activityDuration(start?: number, end?: number): string {
  if (start === undefined || end === undefined || !Number.isFinite(start) || !Number.isFinite(end)) return "—";
  const ms = Math.max(0, end - start);
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor(ms % 60000 / 1000)}s`;
}

export function presentDebugActivity(activity: DebugActivity, run: DebugRunStarted, now: number) {
  const frame = activity.frames[activity.frames.length - 1] ?? activity.lastFrame;
  const operation = frame?.operations[frame.operations.length - 1];
  const search = frame?.search;
  const rows: Array<{ label: string; value: string }> = [];
  let phase = "running";
  let title = "调试运行中";
  let owner = frame?.name ?? run.entry;
  let subtitle = "等待节点执行";

  if (operation) {
    const recognizing = operation.kind === "recognition";
    phase = recognizing ? "recognition" : "action";
    title = recognizing ? "正在识别" : "执行动作";
    if (operation.type === "Custom") title = recognizing ? "自定义识别" : "自定义动作";
    owner = operation.name;
    subtitle = [operation.customName ?? operation.type,
      `已${recognizing ? "识别" : "执行"} ${activityDuration(operation.startedAt, now)}`].filter(Boolean).join(" · ");
    rows.push({ label: recognizing ? "识别节点" : "动作节点", value: operation.name });
    rows.push({ label: recognizing ? "本次识别耗时" : "本次动作耗时", value: activityDuration(operation.startedAt, now) });
    if (operation.type) rows.push({ label: recognizing ? "识别算法" : "动作类型", value: operation.type });
    if (operation.customName) rows.push({ label: "注册名称", value: operation.customName });
  }

  if (search && search.endedAt === undefined && (!operation || operation.candidateIndex !== undefined)) {
    phase = search.roundStatus === "miss" ? "retry" : "search";
    title = search.roundStatus === "miss" ? "等待下一轮" : "识别下一步";
    owner = `${search.owner} · next`;
    subtitle = `已搜索 ${activityDuration(search.startedAt, now)} · 第 ${search.round} 轮`;
    if (operation) subtitle += ` · ${operation.name}`;
  } else if (!operation && search?.roundStatus === "hit") {
    phase = "transition";
    title = frame?.lastOperation?.kind === "action" ? "动作结束，等待后续" : "已命中，等待动作";
    subtitle = frame?.lastOperation?.name ?? "等待执行事件";
  } else if (!operation && frame?.lastOperation) {
    phase = "transition";
    title = "等待后续执行";
    subtitle = `最近${frame.lastOperation.kind === "action" ? "动作" : "识别"}：${frame.lastOperation.name}`;
  }

  if (search) {
    rows.push({ label: "本次搜索", value: activityDuration(search.startedAt, search.endedAt ?? now) });
    rows.push({ label: "当前轮次", value: `第 ${search.round} 轮 · ${activityDuration(search.roundStartedAt, search.roundEndedAt ?? now)}` });
    rows.push({ label: "本轮尝试", value: `${search.attempted} 次 · 列表 ${search.candidates.length} 项` });
    if (search.timeoutMs !== undefined) rows.push({ label: "搜索超时设置", value: search.timeoutMs < 0 ? "无限等待" : `${search.timeoutMs / 1000}s` });
  }
  return { title, owner, subtitle, phase, rows, search, operation, focus: frame?.focus };
}
