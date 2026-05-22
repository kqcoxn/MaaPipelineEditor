import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "assist",
  title: "AI 辅助",
  summary: "把 AI 看成节点配置和流程探索的辅助入口，而不是脱离上下文的独立功能。",
  searchText:
    "AI 辅助 AI 对话历史 流程探索 节点预测 AI 历史 机器人 节点配置预测 工作流程 探索模式 Ghost节点",
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
      id: "ai-workflow",
      title: "AI 节点预测工作流程",
      summary: "从收集上下文到应用配置的完整 pipeline。",
      keywords: ["工作流程", "截图", "识别", "生成", "应用"],
      searchText:
        "工作流程 收集上下文 截图 OCR识别 构建提示词 AI生成 解析结果 应用配置 进度反馈",
      blocks: [
        {
          type: "code",
          language: "text",
          text: "收集上下文 → 设备截图 → OCR 识别 → 构建提示词 → AI 生成 → 解析结果 → 应用配置",
        },
        {
          type: "paragraph",
          text: "每个阶段都有实时进度反馈。AI 对话历史中可以查看每次预测的 token 用量、截图缩略图、完整提示词和回复内容，方便排查异常。",
        },
      ],
    },
    {
      id: "explore-mode",
      title: "流程探索模式",
      summary: "目标驱动、逐步引导的线性流程构建方式。",
      keywords: ["探索模式", "目标驱动", "Ghost节点", "引导式"],
      searchText:
        "探索模式 目标驱动 Ghost节点 引导式 逐步构建 预览 状态流转 线性流程",
      blocks: [
        {
          type: "paragraph",
          text: "流程探索模式适合从零构建线性流程：设定目标后，AI 会逐步引导你添加节点，每步都有 Ghost 节点预览效果。确认后节点正式加入画布，继续下一步直到目标完成。",
        },
        {
          type: "callout",
          calloutType: "info",
          title: "适用场景",
          text: "探索模式最适合路径明确的线性流程（如：打开应用 → 点击按钮 → 等待加载 → 确认结果）。复杂分支逻辑建议手动构建。",
        },
      ],
    },
    {
      id: "keep-human-in-loop",
      title: "把 AI 结果当作草案，不要直接当结论",
      summary: "AI 更擅长给出候选配置和排查方向，最终字段仍应由你确认。",
      keywords: ["人工确认", "候选配置", "验证字段", "模板图片"],
      searchText:
        "AI 草案 人工确认 验证字段 候选配置 OCR ROI 模板截图 模板图片 无法生成",
      blocks: [
        {
          type: "paragraph",
          text: "无论是节点预测还是流程探索，AI 给出的内容都更适合作为草案。涉及 ROI、模板、颜色或动作参数时，仍应回到字段面板和工具箱逐项核对。",
        },
        {
          type: "callout",
          calloutType: "warning",
          title: "模板图片",
          text: "AI 无法生成 TemplateMatch 所需的模板图片，需要你手动使用模板截图工具捕获。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
