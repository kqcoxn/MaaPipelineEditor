import type { AchievementDef } from "../types";
import { countSeries } from "../countSeries";

export const organizeAchievements: AchievementDef[] = [
  {
    id: "organize_align",
    title: "强迫症复印",
    subtitle: "差一个像素都不行。",
    description: "首次对齐至少三个节点，并实际改变节点位置",
    category: "organize",
    trigger: { kind: "counter", counter: "nodes_aligned", target: 1 },
  },
  {
    id: "organize_group_color",
    title: "🎨按颜色站队",
    subtitle: "这个项目开始有派系了。",
    description: "首次修改分组颜色",
    category: "organize",
    hidden: true,
    trigger: { kind: "counter", counter: "group_color_changed", target: 1 },
  },
  {
    id: "organize_edge_control",
    title: "🤏拿捏",
    subtitle: "这下把柄在我手里了。",
    description: "首次拖动边的把柄并改变连接路径",
    category: "organize",
    trigger: { kind: "counter", counter: "edge_control_moved", target: 1 },
  },
  {
    id: "organize_layout",
    title: "各就各位",
    subtitle: "这下舒服了。",
    description: "对至少三个节点完成一次自动布局",
    category: "organize",
    trigger: {
      kind: "counter",
      counter: "layout_completed",
      target: 1,
    },
  },
  {
    id: "explore_group_master",
    title: "收纳达人",
    subtitle: "一家人就要整整齐齐",
    description: "创建分组，并将至少两个节点放入其中",
    category: "organize",
    trigger: {
      kind: "counter",
      counter: "group_organized",
      target: 1,
    },
  },
  {
    id: "organize_search",
    title: "找到你了",
    subtitle: "哼，想逃😏？",
    description: "通过节点搜索定位到节点",
    category: "organize",
    trigger: {
      kind: "counter",
      counter: "search_located",
      target: 1,
    },
  },
  ...countSeries({
    id: "organize_template",
    category: "organize",
    counter: "template_saved",
    title: "⚗️留个配方",
    subtitle: "下次还这么做。",
    action: "保存自定义节点模板",
    targets: [1, 5, 20, 100],
  }),
  {
    id: "organize_reuse",
    title: "📓老方新用",
    subtitle: "熟悉的配方，新的流程。",
    description: "首次使用自定义模板创建节点",
    category: "organize",
    trigger: {
      kind: "counter",
      counter: "template_used",
      target: 1,
    },
  },
];
