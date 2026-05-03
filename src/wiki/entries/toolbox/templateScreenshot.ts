import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "template-screenshot",
  title: "模板截图",
  summary: "模板截图工具用于生成模板素材，并和 ROI、OCR 共用同一张图像上下文。",
  searchText:
    "模板截图 模板工具 模板裁剪 绿幕 ROI OCR 截图素材 LocalBridge",
  steps: [
    {
      id: "capture-template",
      title: "先截到稳定素材，再裁模板",
      summary: "模板截图首先依赖稳定画面和正确区域。",
      keywords: ["模板裁剪", "截图素材", "绿幕"],
      searchText:
        "模板截图 模板裁剪 绿幕 截图素材 模板字段 设备连接",
      blocks: [
        {
          type: "paragraph",
          text: "模板截图适合为模板类字段生成素材。先确认设备画面稳定，再裁出尽量干净、具有辨识度的区域；如果画面抖动或元素重叠，后续模板匹配会更不稳定。",
        },
      ],
    },
    {
      id: "share-image-context",
      title: "模板、ROI、OCR 可以围绕同一张图协作",
      summary: "先有图，再决定是做模板、做范围还是识别文本。",
      keywords: ["同一张图", "ROI", "OCR"],
      searchText:
        "同一张图 模板 ROI OCR 截图工具 图像上下文 字段快捷工具",
      blocks: [
        {
          type: "paragraph",
          text: "截图并不是模板工具的专属前置。很多时候你会先拿到一张稳定截图，再决定接下来要做模板裁剪、ROI 范围还是 OCR 文本识别，因此这些工具更适合被理解为共享图像工作流。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
