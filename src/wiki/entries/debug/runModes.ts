import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "run-modes",
  title: "运行方式",
  summary:
    "根据问题粒度选择从节点运行、单节点运行、仅识别或仅动作，把调试范围切到最小。",
  searchText:
    "运行方式 从节点运行 单节点运行 仅识别 仅动作 回放 replay debug modes 运行模式 入口节点",
  steps: [
    {
      id: "choose-scope",
      title: "先决定你要验证的是全流程还是局部",
      summary: "运行方式的区别本质上是调试范围的区别。",
      keywords: ["从节点运行", "单节点运行", "范围"],
      searchText:
        "从节点运行 单节点运行 调试范围 入口节点 局部验证",
      blocks: [
        {
          type: "paragraph",
          text: "如果你怀疑的是整体流程衔接，就从入口节点开始运行；如果你只想验证某个节点的识别或动作行为，就直接选单节点运行、仅识别或仅动作。把范围切小是调试闭环的核心思路。",
        },
      ],
    },
    {
      id: "four-modes",
      title: "四种运行方式速查",
      summary: "每种方式适合不同的验证目标。",
      keywords: ["从节点运行", "单节点运行", "仅识别", "仅动作"],
      searchText:
        "从节点运行 单节点运行 仅测试识别 仅执行动作 四种 速查 run-from-node single-node-run recognition-only action-only",
      blocks: [
        {
          type: "markdown",
          text: "| 方式 | 说明 | 适用场景 |\n|------|------|----------|\n| 从节点运行 | 以选中节点作为入口运行后续 pipeline | 跳过前置步骤，验证后续流程 |\n| 单节点运行 | 对选中节点执行一次识别与动作组合 | 验证单节点完整行为 |\n| 仅测试识别 | 只验证选中节点的识别逻辑 | 确认识别是否命中 |\n| 仅执行动作 | 跳过识别，直接执行选中节点的动作 | 验证动作效果 |",
        },
        {
          type: "callout",
          calloutType: "info",
          title: "回放模式",
          text: "除了上述四种实时运行方式，FlowScope 还支持 Trace Replay（回放），可以对已有的运行记录按时间顺序逐步重放事件，无需再次连接设备。",
        },
      ],
    },
    {
      id: "entry-node-selection",
      title: "入口节点选择",
      summary: "在中控台选择入口节点，决定运行起点。",
      keywords: ["入口节点", "中控台", "选择"],
      searchText:
        "入口节点 中控台 选择 节点选择器 当前文件 所有节点",
      blocks: [
        {
          type: "paragraph",
          text: "在中控台的运行控制区域，通过节点选择器指定入口节点。默认只显示当前文件中的节点，勾选「包含所有节点」可以选择跨文件的节点。选好入口节点后，再选择运行方式即可发起运行。",
        },
      ],
    },
    {
      id: "recommended-order",
      title: "推荐的验证顺序",
      summary: "从小范围开始，逐步扩大。",
      keywords: ["验证顺序", "渐进", "调试策略"],
      searchText:
        "验证顺序 渐进 调试策略 先仅识别 再单节点 再从节点",
      blocks: [
        {
          type: "code",
          language: "text",
          text: "仅识别（确认能识别）→ 单节点（确认识别+动作）→ 从节点运行（确认后续流程）",
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
