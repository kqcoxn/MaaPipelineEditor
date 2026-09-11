import { countSeries } from "../countSeries";
import type { AchievementDef } from "../types";

export const projectAchievements: AchievementDef[] = [
  {
    id: "project_many_files",
    title: "好多人啊",
    subtitle: "这里站不下这么多人",
    description: "Tab 栏同时打开超过 5 个文件",
    category: "project",
    hidden: true,
    trigger: { kind: "counter", counter: "many_files_open", target: 1 },
  },
  {
    id: "project_layout_image",
    title: "拍张全家福",
    subtitle: "来，所有节点看镜头！",
    description: "首次成功将非空布局导出为图片",
    category: "project",
    trigger: { kind: "counter", counter: "layout_image_saved", target: 1 },
  },
  {
    id: "daily_sync",
    title: "消息同步了",
    subtitle: "收到收到，已与组织保持同步。",
    description: "首次成功重载被外部修改的本地文件，并实际更新画布内容",
    category: "project",
    trigger: { kind: "counter", counter: "local_changes_reloaded", target: 1 },
  },
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
