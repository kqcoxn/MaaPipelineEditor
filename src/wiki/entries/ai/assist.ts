import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "assist",
  title: "AI 辅助",
  summary: "把 AI 看成节点配置和流程探索的辅助入口，而不是脱离上下文的独立功能。",
  searchText:
    "AI 辅助 AI 对话历史 流程探索 节点预测 AI 历史 机器人 节点配置预测",
  steps: [
    {
      id: "entry-map",
      title: "先区分三个 AI 入口",
      summary: "节点预测、流程探索和 AI 对话历史解决的问题并不相同。",
      keywords: ["节点预测", "流程探索", "AI 对话历史"],
      searchText:
        "节点预测 流程探索 AI 对话历史 AI 入口 GlobalPanel 字段面板",
      blocks: [
        {
          type: "paragraph",
          text: "字段面板里的 AI 节点预测适合补当前节点的配置建议；流程探索适合围绕一个目标逐步推进；AI 对话历史则用来回看提示词、推理结果和失败原因。先分清入口，再决定要不要让 AI 介入。",
        },
      ],
    },
    {
      id: "keep-human-in-loop",
      title: "把 AI 结果当作草案，不要直接当结论",
      summary: "AI 更擅长给出候选配置和排查方向，最终字段仍应由你确认。",
      keywords: ["人工确认", "候选配置", "验证字段"],
      searchText:
        "AI 草案 人工确认 验证字段 候选配置 OCR ROI 模板截图",
      blocks: [
        {
          type: "paragraph",
          text: "无论是节点预测还是流程探索，AI 给出的内容都更适合作为草案。涉及 ROI、模板、颜色或动作参数时，仍应回到字段面板和工具箱逐项核对，而不是把生成结果原样提交。",
        },
        {
          type: "markdown",
          text: "完整背景见：[AI 服务](https://mpe.codax.site/docs/guide/server/ai.html)。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
