import type { WikiModule } from "../../types";

const module: WikiModule = {
  id: "roi",
  title: "ROI 工具",
  summary: "ROI 工具用于从截图中快速生成识别范围。",
  steps: [
    {
      id: "select-region",
      title: "框选识别范围",
      summary: "在截图上框选目标区域，并把范围填回字段。",
      blocks: [
        {
          type: "paragraph",
          text: "ROI 工具适合处理图像识别范围。打开工具后，在截图上框选目标区域，确认后会把坐标写回当前字段或工具输出。",
        },
        {
          type: "callout",
          calloutType: "info",
          title: "后续内容",
          text: "P3 会补充包含截图演示的完整 ROI 教程。",
        },
      ],
    },
    {
      id: "negative-coordinates",
      title: "理解负坐标",
      summary: "负坐标可用于表达相对右下角的范围。",
      blocks: [
        {
          type: "paragraph",
          text: "当你需要让范围跟随截图右侧或底部时，可以使用负坐标。MPE 会在预览时帮助你理解最终落点。",
        },
      ],
    },
  ],
};

export default module;
