import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "node-templates",
  title: "节点模板",
  summary: "节点模板面板用于更快地创建常见节点，并复用已经整理好的结构。",
  searchText:
    "节点模板 模板面板 搜索节点模板 预设模板 自定义模板 粘贴节点 创建节点",
  steps: [
    {
      id: "pick-template-fast",
      title: "优先从模板开始，而不是空白手填",
      summary: "模板能帮你更快得到接近目标的起点。",
      keywords: ["预设模板", "自定义模板", "创建节点"],
      searchText:
        "预设模板 自定义模板 创建节点 搜索节点模板 节点模板面板",
      blocks: [
        {
          type: "paragraph",
          text: "节点模板面板适合在创建节点时快速选一个最接近目标的起点。相比空白手填，模板能减少识别类型、动作类型和常见字段的重复录入。",
        },
      ],
    },
    {
      id: "search-preview-paste",
      title: "搜索、预览和粘贴板是同一条复用链路",
      summary: "模板搜索和粘贴板都服务于“少重复输入”。",
      keywords: ["搜索节点模板", "预览", "粘贴板"],
      searchText:
        "搜索节点模板 预览 粘贴板 复制节点 复用结构 自定义模板",
      blocks: [
        {
          type: "paragraph",
          text: "在面板里搜索模板、看节点预览、或者直接粘贴刚复制过的节点，本质上都是为了复用已有结构。找得到现成结构时，优先复用而不是重新创建。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
