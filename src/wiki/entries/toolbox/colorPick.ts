import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "color-pick",
  title: "颜色取点",
  summary: "颜色取点用于从截图中快速获取颜色值，常见于范围色、阈值色和单点色字段。",
  searchText:
    "颜色取点 取色 RGB HSV GRAY lower upper 单点颜色 截图工具 范围预览 颜色模式",
  steps: [
    {
      id: "pick-color-from-screenshot",
      title: "先从正确截图里取色",
      summary: "取色结果依赖当前截图上下文是否正确。",
      keywords: ["取色", "RGB", "HSV", "GRAY", "点击"],
      searchText:
        "取色 RGB HSV GRAY 截图上下文 颜色值 颜色范围 点击像素",
      blocks: [
        {
          type: "paragraph",
          text: "颜色取点建立在当前截图之上。先确认你拿到的是正确画面，再点击目标像素读取颜色值。支持直接点击取色，也可以框选区域取平均色。",
        },
      ],
    },
    {
      id: "color-modes",
      title: "三种颜色模式与范围预览",
      summary: "RGB、HSV、GRAY 三种模式各有适用场景。",
      keywords: ["RGB", "HSV", "GRAY", "范围预览"],
      searchText:
        "RGB HSV GRAY 颜色模式 范围预览 高亮 匹配像素 上下界",
      blocks: [
        {
          type: "markdown",
          text: "- **RGB**：红绿蓝三通道，值域 [0, 255]，适合精确颜色匹配\n- **HSV**：色相/饱和度/明度，适合处理光照变化下的颜色识别\n- **GRAY**：灰度值，适合黑白或单色场景",
        },
        {
          type: "paragraph",
          text: "设置上下界（lower/upper）后，可以开启范围预览功能，截图上会高亮显示所有匹配该颜色范围的像素，帮助你直观确认范围是否合理。",
        },
      ],
    },
    {
      id: "copy-into-fields",
      title: "把结果回填到颜色相关字段",
      summary: "颜色工具的价值在于减少手抄和试错。",
      keywords: ["lower", "upper", "颜色字段", "复制"],
      searchText:
        "lower upper 颜色字段 复制键值对 颜色取点 回填字段 格式一致",
      blocks: [
        {
          type: "paragraph",
          text: "取色后优先使用工具提供的复制值或复制键值对，把结果直接回填到颜色相关字段中。这样能减少手抄错误，也更容易保持上下界格式一致。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
