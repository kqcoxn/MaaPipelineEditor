import type { WikiModule, WikiModuleSearchIndex } from "../../types";

const module: WikiModule = {
  id: "showcase",
  title: "功能展示",
  summary: "快速认识 FlowScope 调试工作台里的核心视图。",
  searchText: "FlowScope 调试工作台 中控台 节点线 事件线 图像面板 调试入口",
  steps: [
    {
      id: "open-workbench",
      title: "打开调试工作台",
      summary: "主视图左上角的调试按钮会打开 FlowScope，而不是切换全局调试模式。",
      searchText:
        "打开调试工作台 FlowScope 调试入口 左上角 调试按钮 画布覆盖层 节点字段面板",
      blocks: [
        {
          type: "paragraph",
          text: "点击左上角工具列表里的调试入口后，MPE 会打开 FlowScope 调试工作台。调试信息集中显示在工作台和画布覆盖层里，不再散落到节点字段面板。",
        },
        {
          type: "callout",
          calloutType: "info",
          title: "截图素材预留",
          text: "后续可把调试工作台总览截图放到 src/wiki/entries/debug/assets/debug-workbench-overview.webp，并把本步骤替换为图片或视频教程。",
        },
      ],
    },
    {
      id: "read-results",
      title: "查看运行结果",
      summary: "用中控台、节点线、事件线和图像面板拆解一次调试运行。",
      searchText:
        "查看运行结果 中控台 节点线 事件线 图像面板 截图 识别 产物",
      blocks: [
        {
          type: "paragraph",
          text: "中控台负责运行控制和摘要，节点线按 Pipeline 节点聚合结果，事件线按 MaaFramework 事件顺序展开细节，图像面板用于查看截图和识别相关产物。",
        },
        {
          type: "code",
          language: "text",
          text: "入口节点 -> 运行 -> 节点线定位问题 -> 事件线查看证据 -> 图像面板核对产物",
        },
      ],
    },
  ],
};

export const searchIndex: WikiModuleSearchIndex = {
  moduleId: "showcase",
  searchText: module.searchText,
  steps: module.steps.map((step) => ({
    stepId: step.id,
    title: step.title,
    summary: step.summary,
    keywords: step.keywords,
    searchText: step.searchText,
  })),
};

export default module;
