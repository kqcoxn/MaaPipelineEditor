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
  },
  {
    id: "explore_fix",
    title: "原来是这里",
    subtitle: "找到了，就好办了。",
    description: "从失败节点详情定位回画布，修改该节点后，下一次同入口流程调试成功（同次打开编辑器期间）",
    category: "explore",
    hidden: true,
    trigger: {
      kind: "counter",
      counter: "debug_fix_completed",
      target: 1
    }
  }
];
