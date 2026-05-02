import type { WikiModule, WikiModuleSearchIndex } from "../../types";

const module: WikiModule = {
  id: "roi",
  title: "ROI 工具",
  summary: "ROI 工具用于从截图中快速生成识别范围。",
  searchText: "ROI 工具 区域选择 框选识别范围 坐标 负坐标 偏移 截图",
  steps: [
    {
      id: "select-region",
      title: "框选识别范围",
      summary: "在截图上框选目标区域，并把范围填回字段。",
      searchText:
        "ROI 区域选择 框选识别范围 截图 坐标 字段 工具输出 识别范围 roi-select-region.webp",
      blocks: [
        {
          type: "paragraph",
          text: "ROI 工具适合处理图像识别范围。打开工具后，在截图上框选目标区域，确认后会把坐标写回当前字段或工具输出。",
        },
        {
          type: "callout",
          calloutType: "info",
          title: "截图素材预留",
          text: "后续可把 ROI 框选截图放到 src/wiki/entries/toolbox/assets/roi-select-region.webp，并把本步骤替换为图片或视频教程。",
        },
      ],
    },
    {
      id: "negative-coordinates",
      title: "理解负坐标",
      summary: "负坐标可用于表达相对右下角的范围。",
      searchText:
        "负坐标 相对右下角 截图右侧 底部 ROI 范围 预览 落点",
      blocks: [
        {
          type: "paragraph",
          text: "当你需要让范围跟随截图右侧或底部时，可以使用负坐标。MPE 会在预览时帮助你理解最终落点。",
        },
      ],
    },
  ],
};

export const searchIndex: WikiModuleSearchIndex = {
  moduleId: "roi",
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
