import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "nodes",
  title: "节点",
  summary: "理解 Pipeline 节点的创建、命名、复制、模板与调试入口。",
  searchText:
    "节点 节点模板 节点名 复制节点 Anchor External Group 调试入口 从节点运行",
  steps: [
    {
      id: "create-node",
      title: "创建或插入节点",
      summary: "从节点列表、节点模板或连接空白处创建节点。",
      keywords: ["创建节点", "节点列表", "节点模板"],
      searchText:
        "创建节点 节点列表 节点模板 连接空白处创建 节点类型 Pipeline External Anchor",
      blocks: [
        {
          type: "paragraph",
          text: "节点可以来自节点列表、节点模板，或从一条连接拖到空白处时直接创建。第一次编辑时，优先把最小路径上的 Pipeline 节点搭起来，再补充 Anchor、External 或分组节点。",
        },
      ],
    },
    {
      id: "reuse-node",
      title: "复用节点而不是重复手填",
      summary: "复制、模板和部分导出都适合做节点复用。",
      keywords: ["复制节点", "保存模板", "部分导出"],
      searchText:
        "复制节点 保存模板 部分导出 节点复用 模板面板 字段顺序",
      blocks: [
        {
          type: "paragraph",
          text: "当某类节点需要反复出现时，优先使用复制、保存模板或部分导出，而不是每次从零手填。字段面板和模板面板会帮助你把可复用结构沉淀下来。",
        },
      ],
    },
    {
      id: "debug-from-node",
      title: "从节点开始调试",
      summary: "Pipeline 节点相关调试入口会打开一次新的调试工作台运行。",
      keywords: ["从节点运行", "单节点运行", "仅识别", "仅动作"],
      searchText:
        "从节点运行 单节点运行 仅识别 仅动作 调试工作台 新调试记录",
      blocks: [
        {
          type: "paragraph",
          text: "当 LocalBridge、控制器和资源准备就绪后，Pipeline 节点的调试动作会直接打开调试工作台，并以当前节点为目标发起一次新的调试运行。这是理解单个节点行为最快的入口。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
