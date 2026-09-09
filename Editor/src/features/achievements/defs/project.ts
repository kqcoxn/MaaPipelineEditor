import { countSeries } from "../countSeries";
import type { AchievementDef } from "../types";

export const projectAchievements: AchievementDef[] = [
  {
    id: "project_import",
    title: "继续（回车）",
    subtitle: "书接上回。",
    description: "成功导入含 Pipeline 节点的文件或代码",
    category: "project",
    trigger: {
      kind: "counter",
      counter: "pipeline_imported",
      target: 1,
    },
  },
  ...countSeries({
    id: "project_save",
    category: "project",
    counter: "pipeline_saved",
    title: "落袋为安",
    subtitle: "保存键，是成年人的安全感。",
    action: "成功保存或导出非空 Pipeline",
    targets: [1, 20, 100, 500, 2000, 10000],
  }),
  {
    id: "project_partial",
    title: "这段能播",
    subtitle: "把这段掐出来，单独发。",
    description: "首次成功部分导出含 Pipeline 节点的内容",
    category: "project",
    trigger: {
      kind: "counter",
      counter: "pipeline_partial_exported",
      target: 1,
    },
  },
  {
    id: "project_separated",
    title: "各回各家",
    subtitle: "工作归工作，装修归装修。",
    description:
      "首次在分离模式下一次成功导出或保存非空 Pipeline 与配置两个文件",
    category: "project",
    trigger: {
      kind: "counter",
      counter: "pipeline_separated_exported",
      target: 1,
    },
  },
];
