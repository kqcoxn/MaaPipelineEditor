import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "common-issues",
  title: "AI 常见问题",
  summary: "AI 失败时，先分辨是设备上下文、API 配置，还是模型能力本身出了问题。",
  searchText:
    "AI 常见问题 AI 失败 AI 配置失败 节点预测失败 流程探索失败 视觉模型",
  steps: [
    {
      id: "split-failure-sources",
      title: "先把失败来源分成三类",
      summary: "大多数 AI 失败都能归到设备现场、配置缺失或模型不支持三类里。",
      keywords: ["AI 失败", "截图失败", "配置缺失", "视觉模型"],
      searchText:
        "AI 失败 截图失败 配置缺失 视觉模型 不支持 vision controller",
      blocks: [
        {
          type: "paragraph",
          text: "当 AI 节点预测或流程探索失败时，先判断是不是设备没连好、截图没拿到、AI API 没配全，还是当前模型不支持视觉。先分清失败来源，再决定要重试、换模型还是回到字段工具手动处理。",
        },
      ],
    },
    {
      id: "use-history-as-evidence",
      title: "优先去 AI 对话历史里看证据",
      summary: "AI 对话历史比重复点击更能说明问题。",
      keywords: ["AI 对话历史", "证据", "失败原因"],
      searchText:
        "AI 对话历史 失败原因 证据 prompt response token 使用记录",
      blocks: [
        {
          type: "paragraph",
          text: "AI 对话历史里会保留输入、回复和失败信息。遇到异常时，先去看历史记录，而不是盲目重复点击同一个入口。这样更容易判断是输入上下文不足，还是远端模型或 API 侧返回了错误。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
