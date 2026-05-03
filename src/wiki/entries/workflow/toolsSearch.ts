import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "tools-search",
  title: "工具与搜索",
  summary: "搜索和常用工具都属于编辑加速器，目标是更快找到节点和完成常见整理动作。",
  searchText:
    "工具与搜索 搜索节点 搜索面板 节点列表 AI搜索 常用工具 编辑加速器",
  steps: [
    {
      id: "search-node-first",
      title: "先用搜索定位节点",
      summary: "当图变大时，搜索节点比手拖画布更高效。",
      keywords: ["搜索节点", "节点列表", "跨文件搜索"],
      searchText:
        "搜索节点 节点列表 跨文件搜索 当前文件 定位节点 搜索面板",
      blocks: [
        {
          type: "paragraph",
          text: "当节点数量变多后，优先用搜索框或节点列表定位目标节点，而不是纯靠拖动画布找位置。搜索面板支持当前文件定位，也可以在配置允许时承接跨文件结果。",
        },
      ],
    },
    {
      id: "treat-tools-as-shortcuts",
      title: "把工具看成高频捷径，不是另一套编辑器",
      summary: "搜索、节点列表和工具入口都在帮你减少重复操作。",
      keywords: ["常用工具", "高频捷径", "AI搜索"],
      searchText:
        "常用工具 高频捷径 AI搜索 节点列表 搜索面板 编辑效率",
      blocks: [
        {
          type: "paragraph",
          text: "搜索、节点列表和工具入口的目标都是减少重复动作。它们不替代节点、字段或连接编辑，而是让你更快抵达正确的位置和操作对象。",
        },
        {
          type: "callout",
          calloutType: "info",
          title: "范围边界",
          text: "本模块只收录编辑器里的高频搜索与工具入口，不展开 AI 配置或调试工作台说明。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
