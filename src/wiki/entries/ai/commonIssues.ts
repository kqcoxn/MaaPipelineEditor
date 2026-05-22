import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "common-issues",
  title: "AI 常见问题",
  summary: "AI 失败时，先分辨是设备上下文、API 配置，还是模型能力本身出了问题。",
  searchText:
    "AI 常见问题 AI 失败 AI 配置失败 节点预测失败 流程探索失败 视觉模型 CORS 速度慢 连接失败",
  steps: [
    {
      id: "split-failure-sources",
      title: "先把失败来源分成三类",
      summary: "大多数 AI 失败都能归到设备现场、配置缺失或模型不支持三类里。",
      keywords: ["AI 失败", "截图失败", "配置缺失", "视觉模型"],
      searchText:
        "AI 失败 截图失败 配置缺失 视觉模型 不支持 vision controller 分类",
      blocks: [
        {
          type: "paragraph",
          text: "当 AI 节点预测或流程探索失败时，先判断是不是设备没连好、截图没拿到、AI API 没配全，还是当前模型不支持视觉。先分清失败来源，再决定要重试、换模型还是回到字段工具手动处理。",
        },
      ],
    },
    {
      id: "specific-errors",
      title: "具体错误与解决",
      summary: "高频问题的快速定位方法。",
      keywords: ["连接失败", "CORS", "OCR失败", "速度慢"],
      searchText:
        "连接失败 设备未连接 API未配置 OCR失败 CORS错误 速度慢 国内API 快速模型",
      blocks: [
        {
          type: "callout",
          calloutType: "warning",
          title: "连接/设备问题",
          text: "提示设备未连接或截图失败：确认 LocalBridge 已连接、设备在线（adb devices 可见或 Win32 窗口存在）。",
        },
        {
          type: "callout",
          calloutType: "warning",
          title: "API 配置问题",
          text: "提示 API 请求失败：确认 API URL、API Key、模型名称三项都已填写，并点击测试连接验证。",
        },
        {
          type: "callout",
          calloutType: "warning",
          title: "CORS 跨域错误",
          text: "浏览器控制台报 CORS 错误：当前 API 提供商不支持浏览器直接请求，换用支持 CORS 的提供商或通过代理访问。",
        },
      ],
    },
    {
      id: "performance-tips",
      title: "预测速度优化",
      summary: "选择合适的模型和提供商可以显著提升响应速度。",
      keywords: ["速度慢", "模型选择", "国内API"],
      searchText:
        "速度慢 模型选择 国内API 快速模型 响应时间 token 优化",
      blocks: [
        {
          type: "paragraph",
          text: "如果预测响应很慢，可以尝试：使用国内友好的 API 提供商减少网络延迟；选择更快的模型（如 GPT-4o-mini）牺牲部分质量换取速度；确认 OCR 配置正确避免重复超时。",
        },
        {
          type: "paragraph",
          text: "AI 对话历史中可以查看每次请求的 token 用量，帮助判断是网络慢还是生成内容过多。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
