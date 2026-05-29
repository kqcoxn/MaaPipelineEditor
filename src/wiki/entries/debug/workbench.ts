import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "workbench",
  title: "调试工作台",
  summary:
    "FlowScope 是 MPE 的调试中枢，包含九个面板，覆盖运行控制、执行追踪、产物查看和诊断排障。",
  searchText:
    "调试工作台 FlowScope 中控台 节点线 事件线 图像 AI总结 性能 诊断 资源体检 调试配置 面板 调试入口",
  steps: [
    {
      id: "what-is-flowscope",
      title: "FlowScope 是什么",
      summary: "FlowScope 是一次性的调试工作台，不是全局模式切换。",
      keywords: ["FlowScope", "调试入口", "工作台"],
      searchText:
        "FlowScope 调试工作台 调试入口 模态窗口 非全局模式",
      blocks: [
        {
          type: "paragraph",
          text: "MPE 的调试不是「打开一种全局模式」，而是打开一次 FlowScope 工作台。后续的运行控制、会话管理、执行追踪和产物查看都围绕这个工作台展开。关闭工作台不会丢失当前会话数据。",
        },
      ],
    },
    {
      id: "nine-panels",
      title: "九个面板速览",
      summary: "每个面板负责一个维度的调试信息。",
      keywords: ["面板", "中控台", "节点线", "事件线", "AI总结"],
      searchText:
        "九个面板 中控台 节点线 事件线 AI总结 性能 图像 诊断 资源体检 调试配置 overview node-execution timeline",
      blocks: [
        {
          type: "markdown",
          text: "| 面板 | 职责 |\n|------|------|\n| 中控台 | 运行控制、会话选择、当前运行摘要 |\n| 节点线 | 按 Pipeline 节点聚合执行路径和节点详情 |\n| 事件线 | 按 mfw seq 查看事件顺序和详情 |\n| AI 总结 | AI 生成的调试摘要和详细报告 |\n| 性能 | 各节点耗时统计和性能摘要 |\n| 图像 | 截图和识别绘制图列表 |\n| 诊断 | 启动前检查、运行时诊断和资源/控制器/Agent 问题 |\n| 资源体检 | 资源路径、加载结果和当前图静态检查 |\n| 调试配置 | 资源路径、控制器、截图和 Agent 配置 |",
        },
      ],
    },
    {
      id: "reading-order",
      title: "推荐阅读顺序",
      summary: "从摘要到细节，逐步钻入。",
      keywords: ["阅读顺序", "中控台", "节点线", "事件线"],
      searchText:
        "阅读顺序 中控台 节点线 事件线 图像 诊断 摘要优先 钻入细节",
      blocks: [
        {
          type: "code",
          language: "text",
          text: "中控台（确认运行状态）→ 节点线（定位可疑节点）→ 事件线（确认事件顺序）→ 图像/诊断（核对证据）",
        },
        {
          type: "paragraph",
          text: "先在中控台确认运行目标与整体状态，再在节点线定位哪个节点可疑，最后去事件线和图像面板核对底层证据。如果运行根本没跑起来，直接看诊断面板和资源体检。",
        },
      ],
    },
    {
      id: "node-execution-modes",
      title: "节点线的两种归因模式",
      summary: "Next 模式和 Pair 模式提供不同的节点聚合视角。",
      keywords: ["Next模式", "Pair模式", "归因模式", "节点线"],
      searchText:
        "Next模式 Pair模式 归因模式 节点线 attribution next node reco action",
      blocks: [
        {
          type: "markdown",
          text: "- **Next 模式**：以 MFW 内部执行逻辑为单位，将当前节点的 action 与 next-list 中的所有 reco 放在一起\n- **Pair 模式**：以物理节点（JSON 定义）为单位，将某个节点的一次 reco-action 对放在一起",
        },
        {
          type: "paragraph",
          text: "Next 模式适合追踪「为什么跳到了这个节点」，Pair 模式适合确认「这个节点本身的识别和动作是否正确」。可以在节点线面板顶部切换。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
