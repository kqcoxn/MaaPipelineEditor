import type { AchievementDef } from "../types";

export const aiAchievements: AchievementDef[] = [
  {
    id: "project_harness",
    title: "搭把手",
    subtitle: "你已经是个成熟的 AI 了。",
    description: "通过 Harness 成功完成一次画布修改",
    category: "ai",
    trigger: {
      kind: "counter",
      counter: "harness_applied",
      target: 1
    }
  }
];
