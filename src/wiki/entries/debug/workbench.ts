import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "workbench",
  title: "调试工作台",
  summary: "调试工作台用于发起运行、查看摘要，并在节点线和事件线中定位问题。",
  searchText:
    "调试工作台 FlowScope 中控台 节点线 事件线 图像 调试入口 运行结果 运行配置 interface 资源 控制器 agent",
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
        {
          type: "markdown",
          text: "工作台包含六个面板：\n- **总览**：运行状态摘要\n- **运行配置**：interface/资源/控制器/agent/产物策略\n- **节点线**：按节点维度查看运行轨迹\n- **事件线（时间线）**：按时间顺序查看所有事件\n- **图像**：截图和识别绘制图\n- **诊断**：错误和警告信息",
        },
      ],
    },
    {
      id: "run-config",
      title: "配置运行参数",
      summary: "运行前需要配置 interface、资源路径、控制器和产物策略。",
      keywords: ["运行配置", "interface", "资源路径", "控制器", "agent"],
      searchText:
        "运行配置 interface.json 资源路径 控制器 ADB Win32 agent 产物策略 artifact",
      blocks: [
        {
          type: "markdown",
          text: "- **Interface**：导入 interface.json 或手动配置任务入口\n- **资源路径**：指向包含 Pipeline 和图片的目录（可多个）\n- **控制器**：ADB（安卓）或 Win32（桌面窗口）\n- **Agent**：可选的自定义 agent 配置\n- **产物策略**：控制截图、识别图等产物的保存粒度",
        },
      ],
    },
    {
      id: "read-panels",
      title: "先看中控台，再看节点线和事件线",
      summary: "推荐的阅读顺序是摘要优先，再逐步钻入细节。",
      keywords: ["中控台", "节点线", "事件线", "图像", "阅读顺序"],
      searchText:
        "中控台 节点线 事件线 图像 运行摘要 调试阅读顺序 失败节点 诊断",
      blocks: [
        {
          type: "code",
          language: "text",
          text: "中控台（总览）→ 节点线（定位可疑节点）→ 事件线（确认顺序）→ 图像/诊断（核对证据）",
        },
        {
          type: "paragraph",
          text: "先在中控台确认这次运行的目标与整体状态，再在节点线定位哪一个节点可疑，最后去事件线和图像面板核对底层证据。这样比直接从海量事件开始看更稳。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
