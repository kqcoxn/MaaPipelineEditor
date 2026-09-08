import type { AchievementDef } from "../types";

export const debugAchievements: AchievementDef[] = [
  {
    id: "debug_first_run",
    title: "点火成功",
    subtitle: "跑起来了！",
    description: "首次成功完成流程调试",
    category: "debug",
    trigger: {
      kind: "counter",
      counter: "debug_run_completed",
      target: 1
    }
  },
  {
    id: "debug_single",
    title: "单独聊聊",
    subtitle: "先把这一小步走好。",
    description: "首次成功完成单节点调试",
    category: "debug",
    trigger: {
      kind: "counter",
      counter: "debug_single_completed",
      target: 1
    }
  },
  {
    id: "debug_recognition",
    title: "先看清楚",
    subtitle: "看清楚，再行动。",
    description: "执行仅识别并获得识别结果",
    category: "debug",
    trigger: {
      kind: "counter",
      counter: "debug_recognition_result",
      target: 1
    }
  },
  {
    id: "debug_details",
    title: "顺藤摸瓜",
    subtitle: "每一步，都有迹可循。",
    description: "打开一次节点执行的详情",
    category: "debug",
    trigger: {
      kind: "counter",
      counter: "debug_details_opened",
      target: 1
    }
  },
  {
    id: "debug_retry",
    title: "再试一次",
    subtitle: "这一次，通了。",
    description: "同一入口流程调试失败后，经编辑再次运行成功（同次打开编辑器期间）",
    category: "debug",
    trigger: {
      kind: "counter",
      counter: "debug_retry_completed",
      target: 1
    }
  },
  {
    id: "debug_runs_10",
    title: "轻车熟路",
    description: "累计成功完成 10 次流程调试",
    category: "debug",
    series: "debug_run",
    tier: 1,
    trigger: {
      kind: "counter",
      counter: "debug_run_completed",
      target: 10
    }
  },
  {
    id: "debug_runs_50",
    title: "反复求证",
    description: "累计成功完成 50 次流程调试",
    category: "debug",
    series: "debug_run",
    tier: 2,
    trigger: {
      kind: "counter",
      counter: "debug_run_completed",
      target: 50
    }
  },
  {
    id: "debug_runs_200",
    title: "久经实测",
    description: "累计成功完成 200 次流程调试",
    category: "debug",
    series: "debug_run",
    tier: 3,
    trigger: {
      kind: "counter",
      counter: "debug_run_completed",
      target: 200
    }
  }
];
