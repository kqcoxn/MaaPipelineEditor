import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "workbench",
  title: "调试工作台",
  summary: "调试工作台用于发起运行、查看摘要，并在节点线和事件线中定位问题。",
  searchText:
    "调试工作台 FlowScope 中控台 节点线 事件线 图像 调试入口 运行结果",
  steps: [
    {
      id: "open-workbench",
      title: "打开工作台而不是切模式",
      summary: "调试入口会打开一个工作台，不是全局开关。",
      keywords: ["FlowScope", "调试入口", "中控台"],
      searchText:
        "打开调试工作台 FlowScope 调试入口 中控台 全局模式 开关",
      blocks: [
        {
          type: "paragraph",
          text: "MPE 的调试不是“打开一种全局模式”，而是打开一次调试工作台。后续的运行、会话、节点线、事件线和图像产物都围绕这个工作台展开。",
        },
      ],
    },
    {
      id: "read-panels",
      title: "先看中控台，再看节点线和事件线",
      summary: "推荐的阅读顺序是摘要优先，再逐步钻入细节。",
      keywords: ["中控台", "节点线", "事件线", "图像"],
      searchText:
        "中控台 节点线 事件线 图像 运行摘要 调试阅读顺序 失败节点",
      blocks: [
        {
          type: "paragraph",
          text: "推荐的阅读顺序是：先在中控台确认这次运行的目标与整体状态，再在节点线定位哪一个节点可疑，最后去事件线和图像面板核对底层证据。这样比直接从海量事件开始看更稳。",
        },
        {
          type: "code",
          language: "text",
          text: "中控台 -> 节点线 -> 事件线 -> 图像 / 诊断",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
