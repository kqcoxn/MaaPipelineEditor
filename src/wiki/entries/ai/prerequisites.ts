import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "prerequisites",
  title: "AI 前置条件",
  summary: "AI 能否真正可用，取决于设备连接、截图来源和 AI 配置是否同时就绪。",
  searchText:
    "AI 前置条件 AI API AI 配置 节点预测 流程探索 连接设备 截图来源 API URL API Key 模型 测试连接 CORS",
  steps: [
    {
      id: "need-device-and-context",
      title: "节点预测与流程探索都依赖现场上下文",
      summary: "没有设备截图或节点上下文，AI 只能空转。",
      keywords: ["设备连接", "截图来源", "节点上下文", "OCR"],
      searchText:
        "设备连接 截图来源 节点上下文 controller LocalBridge 节点预测 流程探索 OCR MaaFramework",
      blocks: [
        {
          type: "paragraph",
          text: "AI 节点预测和流程探索都不是纯文本问答。它们需要当前节点、相邻节点以及设备截图等现场上下文，所以不仅要连上 LocalBridge，还要确保控制器、截图方法和目标设备本身可用。",
        },
        {
          type: "markdown",
          text: "完整前置条件：\n- LocalBridge 已连接\n- 设备已连接（ADB 或 Win32）\n- OCR 已配置（MaaFramework 路径已设置）\n- AI API 已配置",
        },
      ],
    },
    {
      id: "config-steps",
      title: "配置 AI API（三步）",
      summary: "填写 API URL、API Key 和模型名称，然后测试连接。",
      keywords: ["API URL", "API Key", "模型", "测试连接"],
      searchText:
        "API URL API Key 模型名称 测试连接 配置面板 设置 AI配置",
      blocks: [
        {
          type: "code",
          language: "text",
          text: "1. 打开配置面板（⚙️ 图标）\n2. 填写 API URL、API Key、模型名称\n3. 点击「测试连接」确认可用",
        },
        {
          type: "callout",
          calloutType: "warning",
          title: "安全提示",
          text: "API Key 以明文存储在浏览器 localStorage 中，请勿在公共设备上保存。节点预测要求使用支持视觉的模型（如 GPT-4o、Claude 等）。",
        },
      ],
    },
    {
      id: "check-ai-config",
      title: "CORS 问题处理",
      summary: "部分 API 提供商可能存在跨域限制。",
      keywords: ["CORS", "跨域", "代理"],
      searchText:
        "CORS 跨域 代理 API 提供商 浏览器限制 请求失败",
      blocks: [
        {
          type: "paragraph",
          text: "如果测试连接时浏览器报 CORS 错误，说明 API 提供商不允许浏览器直接请求。解决方案：使用支持 CORS 的 API 提供商，或通过 LocalBridge 代理请求（如果支持）。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
