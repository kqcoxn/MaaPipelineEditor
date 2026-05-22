import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "run-modes",
  title: "运行方式",
  summary: "根据问题粒度选择整图运行、从节点运行、单节点运行、仅识别或仅动作。",
  searchText:
    "运行方式 从节点运行 单节点运行 仅识别 仅动作 固定图识别 full run run from node debug modes 完整运行",
  steps: [
    {
      id: "choose-scope",
      title: "先决定你要验证的是全流程还是局部",
      summary: "运行方式的区别，本质上是调试范围的区别。",
      keywords: ["整图运行", "从节点运行", "单节点运行", "范围"],
      searchText:
        "整图运行 从节点运行 单节点运行 调试范围 入口节点 局部验证 完整运行",
      blocks: [
        {
          type: "paragraph",
          text: "如果你怀疑的是整体流程，就从全图或入口节点开始；如果你只想验证某个节点的识别/动作行为，就直接选单节点运行、仅识别或仅动作。把范围切小，是调试闭环的核心思路。",
        },
      ],
    },
    {
      id: "six-modes",
      title: "六种运行方式速查",
      summary: "每种方式适合不同的验证目标。",
      keywords: ["完整运行", "仅识别", "仅动作", "固定图识别"],
      searchText:
        "完整运行 从选中节点 单节点 仅识别 仅动作 固定图识别 六种 速查",
      blocks: [
        {
          type: "markdown",
          text: "| 方式 | 说明 | 适用场景 |\n|------|------|----------|\n| 完整运行 | 从入口节点开始执行全部流程 | 验证整体流程 |\n| 从选中节点 | 从指定节点开始，继续后续流程 | 跳过前置步骤 |\n| 单节点运行 | 只执行一个节点的识别+动作 | 验证单节点行为 |\n| 仅识别 | 只执行识别，不触发动作 | 确认识别是否命中 |\n| 仅动作 | 跳过识别，直接执行动作 | 验证动作效果 |\n| 固定图识别 | 用指定图片代替实时截图做识别 | 离线验证、复现问题 |",
        },
      ],
    },
    {
      id: "recommended-order",
      title: "推荐的验证顺序",
      summary: "从小范围开始，逐步扩大。",
      keywords: ["验证顺序", "渐进", "调试策略"],
      searchText:
        "验证顺序 渐进 调试策略 先仅识别 再单节点 再从节点 最后完整",
      blocks: [
        {
          type: "code",
          language: "text",
          text: "仅识别（确认能识别）→ 单节点（确认识别+动作）→ 从节点（确认后续流程）→ 完整运行",
        },
        {
          type: "paragraph",
          text: "从最小范围开始验证，每一步确认无误后再扩大范围。这样能最快定位问题出在识别、动作还是流程衔接上。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
