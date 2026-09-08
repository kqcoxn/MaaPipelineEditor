import type { AchievementDef } from "../types";

export const canvasAchievements: AchievementDef[] = [
  {
    id: "canvas_first_node",
    title: "第一步",
    subtitle: "万事开头，一个节点。",
    description: "创建第一个 Pipeline 节点",
    category: "canvas",
    trigger: {
      kind: "counter",
      counter: "node_created",
      target: 1
    }
  },
  {
    id: "canvas_rename",
    title: "名字很重要",
    subtitle: "让名字替你说明白。",
    description: "首次修改 Pipeline 节点名称",
    category: "canvas",
    trigger: {
      kind: "counter",
      counter: "node_renamed",
      target: 1
    }
  },
  {
    id: "canvas_field",
    title: "细节决定成败",
    subtitle: "再多想一个参数。",
    description: "首次添加并填写一个可选字段",
    category: "canvas",
    trigger: {
      kind: "counter",
      counter: "field_added",
      target: 1
    }
  },
  {
    id: "canvas_first_paste",
    title: "拿来主义",
    subtitle: "拿来吧你！",
    description: "首次粘贴节点",
    category: "canvas",
    trigger: {
      kind: "counter",
      counter: "nodes_pasted",
      target: 1
    }
  },
  {
    id: "canvas_nodes_10",
    title: "初具雏形",
    description: "累计创建 10 个 Pipeline 节点",
    category: "canvas",
    series: "node_created",
    tier: 1,
    trigger: {
      kind: "counter",
      counter: "node_created",
      target: 10
    }
  },
  {
    id: "canvas_nodes_50",
    title: "渐成规模",
    description: "累计创建 50 个 Pipeline 节点",
    category: "canvas",
    series: "node_created",
    tier: 2,
    trigger: {
      kind: "counter",
      counter: "node_created",
      target: 50
    }
  },
  {
    id: "canvas_nodes_200",
    title: "积木成城",
    description: "累计创建 200 个 Pipeline 节点",
    category: "canvas",
    series: "node_created",
    tier: 3,
    trigger: {
      kind: "counter",
      counter: "node_created",
      target: 200
    }
  }
];
