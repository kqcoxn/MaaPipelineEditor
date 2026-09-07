import type { AchievementDef } from "../types";

/**调试类成就 */
export const debugAchievements: AchievementDef[] = [
  {
    id: "debug_first_run",
    title: "点火成功",
    description: "完成第一次调试运行",
    category: "debug",
    trigger: { kind: "event", on: "debug:run:completed" },
  },
  {
    id: "debug_runs_10",
    title: "轻车熟路",
    description: "累计完成 10 次调试运行",
    category: "debug",
    series: "debug_run",
    tier: 1,
    trigger: { kind: "counter", counter: "debug_run_completed", target: 10 },
  },
  {
    id: "debug_runs_50",
    title: "百炼成钢",
    description: "累计完成 50 次调试运行",
    category: "debug",
    series: "debug_run",
    tier: 2,
    trigger: { kind: "counter", counter: "debug_run_completed", target: 50 },
  },
];
