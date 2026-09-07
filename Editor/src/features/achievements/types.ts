/**
 * 成就系统核心类型
 *
 * 扩展指南：
 * - 新增行为统计：在 defs/counters.ts 中添加 CounterRule（事件 → 计数器映射）
 * - 新增成就：在 defs/ 下对应分类文件中添加 AchievementDef
 * - 个性化触发条件：使用 custom 触发器，通过 watch 声明关心的事件/计数器，
 *   evaluate 中可访问全部 counters、当前事件与已解锁集合
 */

/**成就分类 */
export type AchievementCategory = "canvas" | "debug" | "explore";

export const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, string> = {
  canvas: "画布",
  debug: "调试",
  explore: "探索",
};

/**成就事件（由 listeners 从各 store 推导，或经 bus 显式发射） */
export interface AchievementEvent<T = unknown> {
  /**事件类型，约定形如 `graph:node:add`、`debug:run:completed` */
  type: string;
  /**事件附加上下文数据 */
  payload?: T;
  /**事件发生时间 */
  at: number;
}

/**计数器规则：某类事件到达时为指定计数器累加 */
export interface CounterRule {
  /**计数器 key */
  counter: string;
  /**监听的事件类型 */
  on: string;
  /**从事件提取增量，默认 +1 */
  delta?: (event: AchievementEvent) => number;
}

/**求值上下文：custom 触发器与事件谓词的可用信息 */
export interface EvalContext {
  counters: Readonly<Record<string, number>>;
  unlocked: Readonly<Record<string, { at: number }>>;
  /**本次触发评估的事件（启动全量评估时为空） */
  event?: AchievementEvent;
  /**评估时刻 */
  now: number;
}

/**
 * 成就触发器
 * - counter: 计数器达到阈值（进度 = counters[counter] / target）
 * - event:   单次事件命中（condition 可选进一步过滤）
 * - custom:  完全自定义求值；watch 声明关心的事件类型或计数器 key，
 *            仅当 watch 命中时才重新评估；evaluate 返回 boolean（是否达成）
 *            或 0~1 的进度数值
 */
export type AchievementTrigger =
  | { kind: "counter"; counter: string; target: number }
  | {
      kind: "event";
      on: string;
      condition?: (event: AchievementEvent, ctx: EvalContext) => boolean;
    }
  | {
      kind: "custom";
      watch: string[];
      evaluate: (ctx: EvalContext) => boolean | number;
    };

/**成就定义 */
export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  /**隐藏成就：未解锁时在成就墙中仅显示占位 */
  hidden?: boolean;
  /**系列成就 key：同系列在成就墙合并为一个格子，逐档解锁 */
  series?: string;
  /**档位（从 1 开始），同系列内递增；高档位解锁时附带更强的庆祝反馈 */
  tier?: number;
  trigger: AchievementTrigger;
}

/**单个成就的评估结果 */
export interface AchievementEvalResult {
  /**是否达成 */
  achieved: boolean;
  /**进度 0~1（供成就墙进度条展示） */
  progress: number;
}
