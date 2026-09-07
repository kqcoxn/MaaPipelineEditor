import type { AchievementDef } from "../types";

/**画布操作类成就 */
export const canvasAchievements: AchievementDef[] = [
  {
    id: "canvas_first_node",
    title: "第一步",
    description: "创建第一个节点",
    category: "canvas",
    trigger: { kind: "event", on: "canvas:node:add" },
  },
  {
    id: "canvas_nodes_10",
    title: "初窥门径",
    description: "累计创建 10 个节点",
    category: "canvas",
    series: "node_created",
    tier: 1,
    trigger: { kind: "counter", counter: "node_created", target: 10 },
  },
  {
    id: "canvas_nodes_50",
    title: "渐入佳境",
    description: "累计创建 50 个节点",
    category: "canvas",
    series: "node_created",
    tier: 2,
    trigger: { kind: "counter", counter: "node_created", target: 50 },
  },
  {
    id: "canvas_nodes_200",
    title: "管线大师",
    description: "累计创建 200 个节点",
    category: "canvas",
    series: "node_created",
    tier: 3,
    trigger: { kind: "counter", counter: "node_created", target: 200 },
  },
  {
    id: "canvas_first_edge",
    title: "牵针引线",
    description: "创建第一条连接",
    category: "canvas",
    trigger: { kind: "event", on: "canvas:edge:add" },
  },
  {
    id: "canvas_edges_50",
    title: "千丝万缕",
    description: "累计创建 50 条连接",
    category: "canvas",
    trigger: { kind: "counter", counter: "edge_created", target: 50 },
  },
  {
    id: "canvas_first_paste",
    title: "拿来主义",
    description: "首次粘贴节点",
    category: "canvas",
    trigger: { kind: "event", on: "canvas:graph:paste" },
  },
];
