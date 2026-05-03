import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "run-modes",
  title: "运行方式",
  summary: "根据问题粒度选择整图运行、从节点运行、单节点运行、仅识别或仅动作。",
  searchText:
    "运行方式 从节点运行 单节点运行 仅识别 仅动作 full run run from node debug modes",
  steps: [
    {
      id: "choose-scope",
      title: "先决定你要验证的是全流程还是局部",
      summary: "运行方式的区别，本质上是调试范围的区别。",
      keywords: ["整图运行", "从节点运行", "单节点运行"],
      searchText:
        "整图运行 从节点运行 单节点运行 调试范围 入口节点 局部验证",
      blocks: [
        {
          type: "paragraph",
          text: "如果你怀疑的是整体流程，就从全图或入口节点开始；如果你只想验证某个节点的 reco/action 行为，就直接选单节点运行、仅识别或仅动作。把范围切小，是 P1 调试闭环的核心思路。",
        },
      ],
    },
    {
      id: "from-node",
      title: "搜索“从节点运行”时，优先走节点入口",
      summary: "节点侧的调试动作会直接发起一条新的工作台记录。",
      keywords: ["从节点运行", "入口节点", "新记录"],
      searchText:
        "从节点运行 入口节点 节点调试入口 新调试记录 仅识别 仅动作",
      blocks: [
        {
          type: "paragraph",
          text: "从节点运行、仅识别、仅动作这些入口都算一次新的调试记录。与其在一次大运行里回溯很久，不如从最可疑的节点重新发起一条更短、更聚焦的记录。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
