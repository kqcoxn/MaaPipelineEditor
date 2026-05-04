import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "prerequisites",
  title: "AI 前置条件",
  summary: "AI 能否真正可用，取决于设备连接、截图来源和 AI 配置是否同时就绪。",
  searchText:
    "AI 前置条件 AI API AI 配置 节点预测 流程探索 连接设备 截图来源",
  steps: [
    {
      id: "need-device-and-context",
      title: "节点预测与流程探索都依赖现场上下文",
      summary: "没有设备截图或节点上下文，AI 只能空转。",
      keywords: ["设备连接", "截图来源", "节点上下文"],
      searchText:
        "设备连接 截图来源 节点上下文 controller LocalBridge 节点预测 流程探索",
      blocks: [
        {
          type: "paragraph",
          text: "AI 节点预测和流程探索都不是纯文本问答。它们需要当前节点、相邻节点以及设备截图等现场上下文，所以不仅要连上 LocalBridge，还要确保控制器、截图方法和目标设备本身可用。",
        },
      ],
    },
    {
      id: "check-ai-config",
      title: "再检查 AI API 配置是否完整",
      summary: "只填了地址或只填了 Key 都不算配置完成。",
      keywords: ["AI API", "aiApiUrl", "aiApiKey", "aiModel"],
      searchText:
        "AI API aiApiUrl aiApiKey aiModel 配置面板 支持视觉模型 GPT-4o",
      blocks: [
        {
          type: "paragraph",
          text: "除了连接设备，还要在配置面板里补齐 AI API 地址、Key 和模型。节点预测还要求使用支持视觉的模型，否则即便请求发出去了，也无法正确理解截图内容。",
        },
        {
          type: "markdown",
          text: "配置细节与风险提示见：[AI 服务](https://mpe.codax.site/docs/guide/server/ai.html)。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
