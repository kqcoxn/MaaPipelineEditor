import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "timeline-artifacts",
  title: "事件线与产物",
  summary:
    "当节点线只能告诉你大概位置时，用事件线按 seq 追踪顺序，用图像和产物核对证据。",
  searchText:
    "时间线 事件线 产物 图像 调试证据 截图 识别详情 动作详情 artifact 原始图 绘制图 性能 懒加载 seq 回放",
  steps: [
    {
      id: "read-timeline-order",
      title: "用事件线确认发生顺序",
      summary: "事件线按 mfw seq 排列，适合回答「先发生了什么」。",
      keywords: ["事件线", "seq", "顺序"],
      searchText:
        "事件线 seq 顺序 调试事件 mfw 先后顺序 运行轨迹 timeline",
      blocks: [
        {
          type: "paragraph",
          text: "节点线适合定位「哪个节点有问题」，事件线适合回答「问题是怎么一步步发生的」。事件线按 MaaFramework 的 seq 编号排列所有事件（session、task、node、recognition、action、next-list、screenshot 等），当你需要判断事件的先后顺序时，优先切到事件线面板。",
        },
      ],
    },
    {
      id: "event-kinds",
      title: "事件类型",
      summary: "不同 kind 的事件提供不同维度的信息。",
      keywords: ["session", "task", "node", "recognition", "action"],
      searchText:
        "事件类型 session task node recognition action next-list screenshot diagnostic artifact log wait-freezes kind",
      blocks: [
        {
          type: "markdown",
          text: "| 事件类型 | 含义 |\n|----------|------|\n| session | 会话生命周期（创建/销毁） |\n| task | 任务级别事件 |\n| node | 节点进入/退出 |\n| next-list | 节点的 next 列表执行 |\n| recognition | 识别执行及结果 |\n| action | 动作执行及结果 |\n| wait-freezes | 等待画面冻结 |\n| screenshot | 截图事件 |\n| diagnostic | 运行时诊断信息 |\n| artifact | 产物生成 |\n| log | 日志输出 |",
        },
      ],
    },
    {
      id: "images-panel",
      title: "图像面板：截图和绘制图",
      summary: "图像面板集中展示运行过程中的截图和识别绘制图。",
      keywords: ["图像", "截图", "绘制图", "ROI"],
      searchText:
        "图像面板 截图 绘制图 识别图 ROI 原始图 draw raw screenshot images",
      blocks: [
        {
          type: "paragraph",
          text: "图像面板列出当前展示会话中所有的截图和识别绘制图。绘制图会在截图上标注识别框和点击位置，帮助你直观确认识别是否命中了正确区域。点击具体条目可以查看大图和 ROI 详情。",
        },
      ],
    },
    {
      id: "artifact-lazy-load",
      title: "产物按需加载",
      summary: "产物不会自动全部加载，需要点击具体条目触发。",
      keywords: ["产物", "懒加载", "LocalBridge"],
      searchText:
        "产物 懒加载 点击加载 artifact detail 按需加载 LocalBridge",
      blocks: [
        {
          type: "paragraph",
          text: "产物采用懒加载策略——列表中只显示摘要信息，点击具体条目后才从 LocalBridge 加载完整内容（如大图、详细 JSON）。这样避免一次运行产生大量数据时卡顿。",
        },
        {
          type: "callout",
          calloutType: "info",
          title: "Trace Replay",
          text: "事件线支持 Trace Replay 功能，可以按时间顺序逐步重放事件，帮助理解运行过程中的状态变化。回放时可以控制速度和跳转到指定节点。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
