import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "roi",
  title: "ROI",
  summary: "ROI 工具用于从截图中快速生成识别范围，并帮助理解负坐标。",
  searchText: "ROI 区域选择 识别范围 坐标 负坐标 框选 截图 字段快捷工具",
  steps: [
    {
      id: "select-region",
      title: "框选识别范围",
      summary: "在截图上框选目标区域，并把范围填回字段。",
      keywords: ["ROI", "区域选择", "识别范围"],
      searchText:
        "ROI 区域选择 框选识别范围 截图 坐标 字段 工具输出 识别范围",
      blocks: [
        {
          type: "paragraph",
          text: "ROI 工具适合处理图像识别范围。打开工具后，在截图上框选目标区域，确认后会把坐标写回当前字段或工具输出。",
        },
      ],
    },
    {
      id: "negative-coordinates",
      title: "理解负坐标",
      summary: "负坐标可用于表达相对右下角的范围。",
      keywords: ["负坐标", "相对坐标"],
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

export const searchIndex = createModuleSearchIndex(module);

export default module;
