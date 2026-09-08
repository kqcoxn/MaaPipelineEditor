import type { AchievementEnginePatch } from "@/stores/achievement/achievementStore";
import type {
  AchievementDef,
  AchievementEvalResult,
  AchievementEvent,
  CounterRule,
  EvalContext,
} from "./types";

/**
 * 成就求值引擎（纯函数，不直接读写 store）
 * listeners 层负责采集事件、调用引擎、把返回的 patch 应用到 achievementStore。
 */

/**引擎索引：按计数器 key / 事件类型反查相关成就，避免每次事件全量评估 */
export interface EngineIndex {
  byCounter: Map<string, AchievementDef[]>;
  byEvent: Map<string, AchievementDef[]>;
}

export function buildEngineIndex(defs: AchievementDef[]): EngineIndex {
  const byCounter = new Map<string, AchievementDef[]>();
  const byEvent = new Map<string, AchievementDef[]>();

  const register = (map: Map<string, AchievementDef[]>, key: string, def: AchievementDef) => {
    const list = map.get(key);
    if (list) list.push(def);
    else map.set(key, [def]);
  };

  for (const def of defs) {
    const trigger = def.trigger;
    if (trigger.kind === "counter") {
      register(byCounter, trigger.counter, def);
    } else if (trigger.kind === "event") {
      register(byEvent, trigger.on, def);
    } else {
      // custom 的 watch 项可能同时指事件类型或计数器 key，两侧都注册
      for (const key of trigger.watch) {
        register(byCounter, key, def);
        register(byEvent, key, def);
      }
    }
  }

  return { byCounter, byEvent };
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**评估单个成就 */
export function evaluateAchievement(
  def: AchievementDef,
  ctx: EvalContext,
): AchievementEvalResult {
  const trigger = def.trigger;

  if (trigger.kind === "counter") {
    const current = ctx.counters[trigger.counter] ?? 0;
    const progress =
      trigger.target <= 0 ? 1 : clampProgress(current / trigger.target);
    return { achieved: current >= trigger.target, progress };
  }

  if (trigger.kind === "event") {
    const hit =
      ctx.event !== undefined &&
      ctx.event.type === trigger.on &&
      (trigger.condition ? trigger.condition(ctx.event, ctx) : true);
    return { achieved: hit, progress: hit ? 1 : 0 };
  }

  const result = trigger.evaluate(ctx);
  if (typeof result === "boolean") {
    return { achieved: result, progress: result ? 1 : 0 };
  }
  const progress = clampProgress(result);
  return { achieved: progress >= 1, progress };
}

/**应用计数器规则，返回本次事件产生的计数器增量 */
export function applyCounterRules(
  rules: CounterRule[],
  event: AchievementEvent,
): Record<string, number> {
  const delta: Record<string, number> = {};
  for (const rule of rules) {
    if (rule.on !== event.type) continue;
    const value = rule.delta ? rule.delta(event) : 1;
    if (!Number.isFinite(value) || value === 0) continue;
    delta[rule.counter] = (delta[rule.counter] ?? 0) + value;
  }
  return delta;
}

function collectEvaluations(
  defs: AchievementDef[],
  ctx: EvalContext,
  unlocked: Readonly<Record<string, { at: number }>>,
  patch: Required<Pick<AchievementEnginePatch, "unlock" | "progress">> & {
    evaluated: Set<string>;
  },
): void {
  for (const def of defs) {
    if (patch.evaluated.has(def.id)) continue;
    patch.evaluated.add(def.id);
    if (unlocked[def.id]) continue;

    const result = evaluateAchievement(def, ctx);
    if (result.achieved) {
      patch.unlock.push(def.id);
    } else if (result.progress > 0) {
      patch.progress[def.id] = result.progress;
    }
  }
}

/**
 * 增量评估：处理一个事件
 * 1. 应用计数器规则得到 counterDelta
 * 2. 评估与「事件类型」及「本次变化的计数器」相关的成就
 */
export function handleAchievementEvent(
  index: EngineIndex,
  counterRules: CounterRule[],
  event: AchievementEvent,
  counters: Readonly<Record<string, number>>,
  unlocked: Readonly<Record<string, { at: number }>>,
): AchievementEnginePatch {
  const counterDelta = applyCounterRules(counterRules, event);

  // 增量后的计数器视图（引擎不持有状态，基于传入值 + 增量推导）
  const nextCounters = { ...counters };
  for (const [key, value] of Object.entries(counterDelta)) {
    nextCounters[key] = (nextCounters[key] ?? 0) + value;
  }

  const ctx: EvalContext = {
    counters: nextCounters,
    unlocked,
    event,
    now: event.at,
  };

  const collected = {
    unlock: [] as string[],
    progress: {} as Record<string, number>,
    evaluated: new Set<string>(),
  };

  const eventDefs = index.byEvent.get(event.type);
  if (eventDefs) collectEvaluations(eventDefs, ctx, unlocked, collected);

  for (const counterKey of Object.keys(counterDelta)) {
    const counterDefs = index.byCounter.get(counterKey);
    if (counterDefs) collectEvaluations(counterDefs, ctx, unlocked, collected);
  }

  const patch: AchievementEnginePatch = {};
  if (Object.keys(counterDelta).length > 0) patch.counterDelta = counterDelta;
  if (collected.unlock.length > 0) patch.unlock = collected.unlock;
  if (Object.keys(collected.progress).length > 0)
    patch.progress = collected.progress;
  return patch;
}

/**
 * 全量评估：启动回溯 / 配置导入后调用
 * 基于已有计数器重新计算所有未解锁成就，返回需补发的解锁与进度快照
 */
export function evaluateAllAchievements(
  defs: AchievementDef[],
  counters: Readonly<Record<string, number>>,
  unlocked: Readonly<Record<string, { at: number }>>,
): AchievementEnginePatch {
  const ctx: EvalContext = { counters, unlocked, now: Date.now() };
  const collected = {
    unlock: [] as string[],
    progress: {} as Record<string, number>,
    evaluated: new Set<string>(),
  };
  collectEvaluations(defs, ctx, unlocked, collected);

  const patch: AchievementEnginePatch = {};
  if (collected.unlock.length > 0) patch.unlock = collected.unlock;
  if (Object.keys(collected.progress).length > 0)
    patch.progress = collected.progress;
  return patch;
}
