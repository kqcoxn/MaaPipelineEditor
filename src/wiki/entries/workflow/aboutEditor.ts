import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "about-editor",
  title: "认识工作流编辑器",
  summary: "先建立对画布、主面板和高频操作区的整体认知，再深入节点、字段和连接细节。",
  searchText:
    "认识工作流编辑器 工作流编辑器 画布 节点面板 字段面板 连接面板 搜索 文件视口",
  steps: [
    {
      id: "editor-map",
      title: "先建立主界面地图",
      summary: "把画布、节点相关区、工具区和文件区分开看，会更容易上手。",
      keywords: ["画布", "文件区", "工具区", "面板"],
      searchText:
        "画布 文件区 工具区 面板 节点面板 字段面板 连接面板 Pipeline 面板",
      blocks: [
        {
          type: "paragraph",
          text: "工作流编辑器的核心是画布，节点、字段、连接和文件操作都围绕它展开。先理解各面板各管什么，再去记具体按钮，会比从细节硬背更快。",
        },
      ],
    },
    {
      id: "high-frequency-path",
      title: "高频编辑路径",
      summary: "P1 关注的是创建节点、连线、改字段、导入导出和调试前置这条主路径。",
      keywords: ["高频路径", "创建节点", "导入导出"],
      searchText:
        "高频路径 创建节点 连接节点 改字段 导入导出 调试前置 Pipeline 面板",
      blocks: [
        {
          type: "code",
          language: "text",
          text: "节点模板 / 搜索 -> 创建节点 -> 连接 -> 字段面板 -> Pipeline / 导入导出 -> 调试",
        },
        {
          type: "paragraph",
          text: "如果你是第一次进来，优先沿着这条主路径理解产品，而不是一开始就深入所有面板和高级机制。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
