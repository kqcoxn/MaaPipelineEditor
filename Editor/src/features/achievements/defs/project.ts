import type { AchievementDef } from "../types";

export const projectAchievements: AchievementDef[] = [
  {
    id: "project_import",
    title: "接着往下写",
    subtitle: "从已有的思路继续。",
    description: "成功导入含 Pipeline 节点的文件或代码",
    category: "project",
    trigger: {
      kind: "counter",
      counter: "pipeline_imported",
      target: 1
    }
  },
  {
    id: "project_save",
    title: "落袋为安",
    subtitle: "这一份，收好了。",
    description: "成功导出非空 Pipeline，或成功保存到本地文件",
    category: "project",
    trigger: {
      kind: "counter",
      counter: "pipeline_saved",
      target: 1
    }
  },
  {
    id: "project_preview",
    title: "图文对照",
    subtitle: "画布和代码，对上了。",
    description: "从 Pipeline 预览定位到对应节点",
    category: "project",
    trigger: {
      kind: "counter",
      counter: "preview_located",
      target: 1
    }
  },
  {
    id: "project_harness",
    title: "搭把手",
    subtitle: "想法有了，一起搭起来。",
    description: "通过 Harness 成功完成一次画布修改",
    category: "project",
    trigger: {
      kind: "counter",
      counter: "harness_applied",
      target: 1
    }
  }
];
