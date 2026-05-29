import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "troubleshooting",
  title: "调试排障",
  summary:
    "当调试失败或结果不符合预期时，按前置条件、诊断面板、运行范围的顺序排查。",
  searchText:
    "调试排障 调试失败 运行失败 前置条件 诊断 排查 LocalBridge 资源 控制器 常见错误 日志 资源体检",
  steps: [
    {
      id: "check-preconditions-first",
      title: "调试失败先回头看前置条件",
      summary: "LocalBridge、控制器、资源任一缺失都会让结果失真。",
      keywords: ["调试失败", "前置条件", "LocalBridge"],
      searchText:
        "调试失败 前置条件 LocalBridge 控制器 资源路径 截图来源 运行失败",
      blocks: [
        {
          type: "paragraph",
          text: "当调试根本跑不起来，或者跑出来的结果明显不可信时，不要先怀疑业务节点。先确认 LocalBridge 已连、控制器就绪、资源加载成功，再看节点本身。工作台顶部的黄色警告会直接告诉你缺了什么。",
        },
      ],
    },
    {
      id: "use-diagnostics",
      title: "善用诊断面板和资源体检",
      summary: "诊断面板汇总所有错误和警告，资源体检定位加载问题。",
      keywords: ["诊断", "资源体检", "错误", "警告"],
      searchText:
        "诊断面板 资源体检 错误 警告 启动前检查 运行时诊断 加载失败 静态检查",
      blocks: [
        {
          type: "markdown",
          text: "- **诊断面板**：汇总启动前检查、运行时诊断和资源/控制器/Agent 问题，按严重程度分类\n- **资源体检面板**：集中展示资源路径解析、加载结果和当前图静态检查，加载失败时直接列出具体线索",
        },
        {
          type: "paragraph",
          text: "两个面板配合使用：诊断面板告诉你「出了什么错」，资源体检告诉你「资源哪里有问题」。",
        },
      ],
    },
    {
      id: "common-errors",
      title: "常见错误与解决",
      summary: "几个高频错误的快速定位方法。",
      keywords: ["资源路径", "控制器不可用", "图片未显示"],
      searchText:
        "缺少资源路径 控制器不可用 识别图未显示 常见错误 解决方案 ADB Win32",
      blocks: [
        {
          type: "callout",
          calloutType: "warning",
          title: "缺少资源路径",
          text: "调试配置中未添加资源路径，或路径指向的目录不包含有效的 Pipeline JSON 文件。在调试配置面板中检查资源路径列表。",
        },
        {
          type: "callout",
          calloutType: "warning",
          title: "控制器不可用",
          text: "设备未连接或连接已断开。ADB 设备检查 adb devices 是否可见；Win32 检查目标窗口是否存在且未最小化。",
        },
        {
          type: "callout",
          calloutType: "warning",
          title: "识别图/详情未显示",
          text: "调试配置中的产物策略（saveDraw）未开启，或产物尚未加载。确认 maaOptions 中 saveDraw 为 true。",
        },
        {
          type: "callout",
          calloutType: "warning",
          title: "Agent 连接失败",
          text: "Agent 配置的 transport 方式（identifier 或 tcp）与实际 Agent 不匹配，或 Agent 进程未启动。在调试配置面板中使用 Agent 测试功能确认连通性。",
        },
      ],
    },
    {
      id: "shrink-scope",
      title: "把排查范围缩小到最短可复现路径",
      summary: "单节点运行、仅识别、仅动作通常比从节点运行更高效。",
      keywords: ["单节点运行", "仅识别", "仅动作", "缩小范围"],
      searchText:
        "单节点运行 仅识别 仅动作 缩小范围 最短复现 调试排障 重新发起",
      blocks: [
        {
          type: "paragraph",
          text: "如果从节点运行产生的信息太多，优先改用单节点运行、仅识别或仅动作，把问题压缩到最短可复现路径。通过重新发起小范围运行来排障，比在一条超长记录里回溯更高效。",
        },
      ],
    },
    {
      id: "ai-summary-help",
      title: "让 AI 总结帮你梳理",
      summary: "AI 总结面板可以自动生成调试摘要，快速定位关键信息。",
      keywords: ["AI总结", "摘要", "报告"],
      searchText:
        "AI总结 摘要 报告 自动生成 调试摘要 详细报告 上下文",
      blocks: [
        {
          type: "paragraph",
          text: "当运行记录较长或事件较多时，可以切到 AI 总结面板查看自动生成的调试摘要。它会提取关键失败点、异常模式和建议的排查方向，帮你快速建立全局认知后再钻入细节。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
