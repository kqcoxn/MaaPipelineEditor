import type { AchievementDef } from "../types";

export const connectionAchievements: AchievementDef[] = [
  {
    id: "canvas_first_edge",
    title: "牵针引线",
    subtitle: "这下接上了。",
    description: "创建第一条连接",
    category: "connection",
    trigger: {
      kind: "counter",
      counter: "edge_created",
      target: 1
    }
  },
  {
    id: "connection_branch",
    title: "多一个选择",
    subtitle: "这条路不通，还有下一条。",
    description: "为同一节点连接两个不同的 next 目标",
    category: "connection",
    trigger: {
      kind: "counter",
      counter: "branch_created",
      target: 1
    }
  },
  {
    id: "connection_error",
    title: "留条后路",
    subtitle: "意料之外，也在计划之内。",
    description: "首次创建 on_error 连接",
    category: "connection",
    trigger: {
      kind: "counter",
      counter: "error_edge_created",
      target: 1
    }
  },
  {
    id: "connection_external",
    title: "隔空呼应",
    subtitle: "隔着文件，也接得上话。",
    description: "通过外部节点建立跨文件连接，并成功解析目标",
    category: "connection",
    trigger: {
      kind: "counter",
      counter: "external_connected",
      target: 1
    }
  }
];
