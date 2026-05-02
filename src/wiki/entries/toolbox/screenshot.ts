import type { WikiModule, WikiModuleSearchIndex } from "../../types";

const module: WikiModule = {
  id: "screenshot",
  title: "截图工具",
  summary: "截图工具为 ROI、OCR、模板选择等流程提供图像输入。",
  searchText: "截图工具 模板截图 ROI OCR 模板裁剪 LocalBridge 设备连接",
  steps: [
    {
      id: "capture-source",
      title: "获取截图",
      summary: "从已连接设备或现有图片中获取操作素材。",
      searchText:
        "获取截图 LocalBridge 设备连接 截图素材 ROI OCR 模板裁剪 screenshot-capture-source.webp",
      blocks: [
        {
          type: "paragraph",
          text: "截图相关工具通常依赖 LocalBridge 和已连接设备。获取截图后，可以继续进行 ROI 框选、OCR 识别或模板裁剪。",
        },
        {
          type: "callout",
          calloutType: "warning",
          title: "连接状态",
          text: "如果截图失败，请先检查 LocalBridge 和设备连接状态。后续可把截图流程素材放到 src/wiki/entries/toolbox/assets/screenshot-capture-source.webp。",
        },
      ],
    },
    {
      id: "reuse-image",
      title: "复用截图结果",
      summary: "同一张截图可以在多个工具中继续使用。",
      searchText:
        "复用截图结果 同一张图片 ROI 框选 OCR 模板工具 字段",
      blocks: [
        {
          type: "paragraph",
          text: "完成截图后，可以在不同工具中围绕同一张图片继续处理，例如先裁剪 ROI，再用 OCR 或模板工具辅助填字段。",
        },
      ],
    },
  ],
};

export const searchIndex: WikiModuleSearchIndex = {
  moduleId: "screenshot",
  searchText: module.searchText,
  steps: module.steps.map((step) => ({
    stepId: step.id,
    title: step.title,
    summary: step.summary,
    keywords: step.keywords,
    searchText: step.searchText,
  })),
};

export default module;
