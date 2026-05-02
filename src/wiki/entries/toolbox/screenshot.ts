import type { WikiModule } from "../../types";

const module: WikiModule = {
  id: "screenshot",
  title: "截图工具",
  summary: "截图工具为 ROI、OCR、模板选择等流程提供图像输入。",
  steps: [
    {
      id: "capture-source",
      title: "获取截图",
      summary: "从已连接设备或现有图片中获取操作素材。",
      blocks: [
        {
          type: "paragraph",
          text: "截图相关工具通常依赖 LocalBridge 和已连接设备。获取截图后，可以继续进行 ROI 框选、OCR 识别或模板裁剪。",
        },
        {
          type: "callout",
          calloutType: "warning",
          title: "连接状态",
          text: "如果截图失败，请先检查 LocalBridge 和设备连接状态。",
        },
      ],
    },
    {
      id: "reuse-image",
      title: "复用截图结果",
      summary: "同一张截图可以在多个工具中继续使用。",
      blocks: [
        {
          type: "paragraph",
          text: "完成截图后，可以在不同工具中围绕同一张图片继续处理，例如先裁剪 ROI，再用 OCR 或模板工具辅助填字段。",
        },
      ],
    },
  ],
};

export default module;
