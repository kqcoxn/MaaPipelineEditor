import type { AchievementDef } from "../types";

export const exploreAchievements: AchievementDef[] = [
  {
    id: "explore_redo",
    title: "还是原来的好",
    subtitle: "这一圈也没白绕。",
    description: "一次修改后撤销，再重做该修改",
    category: "explore",
    hidden: true,
    trigger: {
      kind: "counter",
      counter: "history_redone",
      target: 1
    }
  }
];
