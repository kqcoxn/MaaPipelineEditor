import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "color-pick",
  title: "颜色取点",
  summary: "颜色取点用于从截图中快速获取颜色值，常见于范围色、阈值色和单点色字段。",
  searchText:
    "颜色取点 取色 RGB HSV GRAY lower upper 单点颜色 截图工具",
  steps: [
    {
      id: "pick-color-from-screenshot",
      title: "先从正确截图里取色",
      summary: "取色结果依赖当前截图上下文是否正确。",
      keywords: ["取色", "RGB", "HSV", "GRAY"],
      searchText:
        "取色 RGB HSV GRAY 截图上下文 颜色值 颜色范围",
      blocks: [
        {
          type: "paragraph",
          text: "颜色取点建立在当前截图之上。先确认你拿到的是正确画面，再去读取 RGB、HSV 或灰度值，否则就算数字看起来合理，也可能对应错对象。",
        },
      ],
    },
    {
      id: "copy-into-fields",
      title: "把结果回填到颜色相关字段",
      summary: "颜色工具的价值在于减少手抄和试错。",
      keywords: ["lower", "upper", "颜色字段"],
      searchText:
        "lower upper 颜色字段 复制键值对 颜色取点 回填字段",
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
