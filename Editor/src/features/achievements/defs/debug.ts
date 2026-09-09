import { countSeries } from "../countSeries";
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
      target: 1,
    },
  },
  {
    id: "debug_single",
    title: "单独聊聊",
    subtitle: "你，出来一下。",
    description: "首次成功完成单节点调试",
    category: "debug",
    trigger: {
      kind: "counter",
      counter: "debug_single_completed",
      target: 1,
    },
  },
  {
    id: "debug_recognition",
    title: "我就看看",
    subtitle: "我看不清，看不清啊！",
    description: "执行仅识别并获得识别结果",
    category: "debug",
    trigger: {
      kind: "counter",
      counter: "debug_recognition_result",
      target: 1,
    },
  },
  {
    id: "debug_details",
    title: "顺藤摸瓜",
    subtitle: "展开说说。",
    description: "打开一次节点执行的详情",
    category: "debug",
    trigger: {
      kind: "counter",
      counter: "debug_details_opened",
      target: 1,
    },
  },
  {
    id: "debug_retry",
    hidden: true,
    title: "复活吧我的流程！",
    subtitle: "刚才外面人多。",
    description:
      "同一入口流程调试失败后，经编辑再次运行成功（同次打开编辑器期间）",
    category: "debug",
    trigger: {
      kind: "counter",
      counter: "debug_retry_completed",
      target: 1,
    },
  },
  ...countSeries({
    id: "debug_runs",
    category: "debug",
    counter: "debug_completed",
    series: "debug_run",
    title: "这次一定",
    subtitle: "这次应该没问题了...吧？",
    action: "成功完成调试（任意调试方式）",
    targets: [10, 50, 200, 1000, 5000, 20000],
  }),
  {
    id: "debug_action",
    title: "少说多做",
    subtitle: "干就完了",
    description: "首次成功完成仅执行动作",
    category: "debug",
    trigger: {
      kind: "counter",
      counter: "debug_action_completed",
      target: 1,
    },
  },
  {
    id: "debug_stop",
    title: "紧急下班",
    subtitle: "今天就先跑到这里。",
    description: "首次手动停止正在运行的调试，并成功停止",
    category: "debug",
    hidden: true,
    trigger: {
      kind: "counter",
      counter: "debug_manual_stopped",
      target: 1,
    },
  },
  {
    id: "debug_image",
    title: "呈堂证供",
    subtitle: "口说无凭，上图！",
    description: "首次在节点执行详情中打开并成功展示调试图像",
    category: "debug",
    trigger: {
      kind: "counter",
      counter: "debug_image_opened",
      target: 1,
    },
  },
  {
    id: "explore_fix",
    title: "原来是这里",
    subtitle: "你小子藏得挺深啊！",
    description:
      "从失败节点详情定位回画布，修改该节点后，下一次同入口流程调试成功（同次打开编辑器期间）",
    category: "debug",
    hidden: true,
    trigger: {
      kind: "counter",
      counter: "debug_fix_completed",
      target: 1,
    },
  },
];
