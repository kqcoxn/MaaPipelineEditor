import type { AchievementDef } from "../types";

export const organizeAchievements: AchievementDef[] = [
  {
    id: "organize_layout",
    title: "各就各位",
    subtitle: "舒服了。",
    description: "对至少三个节点完成一次自动布局",
    category: "organize",
    trigger: {
      kind: "counter",
      counter: "layout_completed",
      target: 1
    }
  },
  {
    id: "explore_group_master",
    title: "收纳达人",
    subtitle: "整整齐齐，舒舒服服。",
    description: "创建分组，并将至少两个节点放入其中",
    category: "organize",
    trigger: {
      kind: "counter",
      counter: "group_organized",
      target: 1
    }
  },
  {
    id: "organize_search",
    title: "找到你了",
    subtitle: "原来躲在这里。",
    description: "通过节点搜索定位到节点",
    category: "organize",
    trigger: {
      kind: "counter",
      counter: "search_located",
      target: 1
    }
  },
  {
    id: "organize_template",
    title: "留个配方",
    subtitle: "下次还这么做。",
    description: "首次保存自定义节点模板",
    category: "organize",
    trigger: {
      kind: "counter",
      counter: "template_saved",
      target: 1
    }
  },
  {
    id: "organize_reuse",
    title: "老方新用",
    subtitle: "熟悉的配方，新的流程。",
    description: "首次使用自定义模板创建节点",
    category: "organize",
    trigger: {
      kind: "counter",
      counter: "template_used",
      target: 1
    }
  },
  {
    id: "template_uses_5",
    title: "有样可循",
    description: "累计使用自定义模板创建 5 个节点",
    category: "organize",
    series: "template_used",
    tier: 1,
    trigger: {
      kind: "counter",
      counter: "template_used",
      target: 5
    }
  },
  {
    id: "template_uses_20",
    title: "信手拈来",
    description: "累计使用自定义模板创建 20 个节点",
    category: "organize",
    series: "template_used",
    tier: 2,
    trigger: {
      kind: "counter",
      counter: "template_used",
      target: 20
    }
  },
  {
    id: "template_uses_50",
    title: "自成一套",
    description: "累计使用自定义模板创建 50 个节点",
    category: "organize",
    series: "template_used",
    tier: 3,
    trigger: {
      kind: "counter",
      counter: "template_used",
      target: 50
    }
  }
];
