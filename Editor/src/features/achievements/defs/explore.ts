import type { AchievementDef } from "../types";

/**探索类成就（含 custom 触发器示例：个性化条件可完全自定义求值） */
export const exploreAchievements: AchievementDef[] = [
  {
    id: "explore_night_owl",
    title: "夜猫子",
    subtitle: "月亮不睡我不睡。",
    description: "在 23:00 - 05:00 之间创建节点",
    category: "explore",
    hidden: true,
    trigger: {
      kind: "custom",
      watch: ["canvas:node:add"],
      evaluate: (ctx) => {
        if (!ctx.event) return false;
        const hour = new Date(ctx.event.at).getHours();
        return hour >= 23 || hour < 5;
      },
    },
  },
  {
    id: "explore_group_master",
    title: "收纳达人",
    subtitle: "整整齐齐，舒舒服服。",
    description: "累计创建 5 个分组",
    category: "explore",
    trigger: { kind: "counter", counter: "group_created", target: 5 },
  },
];
