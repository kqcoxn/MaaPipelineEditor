import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "roi",
  title: "ROI",
  summary: "ROI 工具用于从截图中快速生成识别范围，并帮助理解负坐标。",
  searchText:
    "ROI 区域选择 识别范围 坐标 负坐标 框选 截图 字段快捷工具 target begin end 手动输入",
  steps: [
    {
      id: "select-region",
      title: "框选识别范围",
      summary: "在截图上框选目标区域，并把范围填回字段。",
      keywords: ["ROI", "区域选择", "识别范围", "框选"],
      searchText:
        "ROI 区域选择 框选识别范围 截图 坐标 字段 工具输出 识别范围 拖拽",
      blocks: [
        {
          type: "paragraph",
          text: "ROI 工具适合处理图像识别范围。打开工具后，在截图上拖拽框选目标区域，确认后会把坐标（[x, y, w, h] 格式）写回当前字段或工具输出。",
        },
        {
          type: "paragraph",
          text: "也可以直接手动输入坐标值进行精确调整，适合需要像素级精度的场景。",
        },
      ],
    },
    {
      id: "applicable-fields",
      title: "适用字段",
      summary: "roi、target、begin、end 等字段都可以用 ROI 工具填写。",
      keywords: ["roi", "target", "begin", "end"],
      searchText:
        "roi target begin end 适用字段 区域选择 识别范围 滑动起点 滑动终点",
      blocks: [
        {
          type: "markdown",
          text: "- **roi**：识别范围，限定识别算法的搜索区域\n- **target**：点击目标区域（会在区域内随机取点）\n- **begin / end**：滑动起点和终点区域",
        },
      ],
    },
    {
      id: "negative-coordinates",
      title: "理解负坐标",
      summary: "负坐标可用于表达相对右下角的范围。",
      keywords: ["负坐标", "相对坐标", "右下角"],
      searchText:
        "负坐标 相对右下角 截图右侧 底部 ROI 范围 预览 落点 自适应",
      blocks: [
        {
          type: "paragraph",
          text: "当你需要让范围跟随截图右侧或底部时，可以使用负坐标。例如 w 为负值表示从右边缘向左计算宽度。MPE 会在预览时帮助你理解最终落点，适合需要自适应不同分辨率的场景。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
