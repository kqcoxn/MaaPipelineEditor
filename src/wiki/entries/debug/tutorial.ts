import type { WikiModule, WikiModuleSearchIndex } from "../../types";

const module: WikiModule = {
  id: "tutorial",
  title: "调试方法",
  summary: "从选择入口节点到阅读结果的基础调试路径。",
  searchText: "调试方法 入口节点 单节点运行 仅识别 仅动作 节点线 事件线",
  steps: [
    {
      id: "choose-entry",
      title: "选择入口节点",
      summary: "从你想验证的节点开始一次独立调试。",
      keywords: ["入口节点", "单节点", "识别", "动作"],
      searchText:
        "选择入口节点 独立调试 单节点运行 仅识别 仅动作 新的调试记录 断点 继续 单步",
      blocks: [
        {
          type: "paragraph",
          text: "MPE 的调试更适合按一次具体目标来理解：可以从节点开始运行，也可以做单节点运行、仅识别或仅动作。每一次都会形成一条新的调试记录。",
        },
        {
          type: "callout",
          calloutType: "warning",
          title: "不要按断点思路理解",
          text: "当前调试模型不提供断点、继续、单步语义；遇到问题时推荐调整入口节点并重新运行。",
        },
      ],
    },
    {
      id: "inspect-node-line",
      title: "阅读节点线",
      summary: "优先从节点线判断哪个节点或步骤出现异常。",
      searchText:
        "阅读节点线 Pipeline 节点 聚合执行结果 失败节点 截图产物 reco action 事件线",
      blocks: [
        {
          type: "paragraph",
          text: "节点线按 Pipeline 节点聚合执行结果，适合先看整体状态、失败节点、截图产物和 reco/action 对应关系。定位到具体节点后，再进入事件线查看底层事件顺序。",
        },
      ],
    },
  ],
};

export const searchIndex: WikiModuleSearchIndex = {
  moduleId: "tutorial",
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
