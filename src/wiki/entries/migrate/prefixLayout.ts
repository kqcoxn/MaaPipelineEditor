import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "prefix-layout",
  title: "统一前缀与自动布局",
  summary: "迁移后的第一轮整理，优先处理前缀、命名和自动布局预期。",
  searchText:
    "统一前缀 自动布局 节点前缀 导入旧 Pipeline 布局整理 命名修复",
  steps: [
    {
      id: "normalize-prefix",
      title: "先把前缀和命名方式理顺",
      summary: "前缀不统一时，后续调试、搜索和复用都会更混乱。",
      keywords: ["统一前缀", "命名修复"],
      searchText:
        "统一前缀 命名修复 节点前缀 旧 Pipeline 迁移 命名结构",
      blocks: [
        {
          type: "paragraph",
          text: "迁移旧文件后，优先确认节点前缀和命名风格是否统一。命名如果一开始就混乱，后续的搜索、复用和调试都会一起变得难读。",
        },
      ],
    },
    {
      id: "use-auto-layout-carefully",
      title: "把自动布局当作整理起点，不是最终答案",
      summary: "自动布局擅长把图理顺，但不负责表达业务含义。",
      keywords: ["自动布局", "布局整理"],
      searchText:
        "自动布局 布局整理 迁移后理顺 业务含义 手动优化 节点关系",
      blocks: [
        {
          type: "paragraph",
          text: "自动布局能帮你快速把旧图展开成可读状态，但它不知道哪些分支是主路径、哪些节点需要贴近。建议把自动布局当作第一轮清理，再围绕真实业务路径做人工微调。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
