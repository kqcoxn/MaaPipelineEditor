import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "file-viewport",
  title: "文件与视口",
  summary: "把文件切换、标签页管理和画布视口操作分开理解，能减少编辑时的迷路感。",
  searchText:
    "文件与视口 文件视口 标签页 切换文件 画布视口 缩放 定位 节点焦点",
  steps: [
    {
      id: "file-vs-local-files",
      title: "先区分标签页和本地文件",
      summary: "当前标签页切换和真实工作目录管理不是同一件事。",
      keywords: ["标签页", "本地文件", "切换文件"],
      searchText:
        "标签页 本地文件 切换文件 Pipeline 面板 LocalBridge 工作目录",
      blocks: [
        {
          type: "paragraph",
          text: "顶部文件区负责当前编辑标签页的切换、命名和顺序；而真实工作目录中的文件浏览、打开与创建属于 LocalBridge 本地文件能力。把这两层分清，能避免把“切标签页”和“切工作目录”混在一起。",
        },
      ],
    },
    {
      id: "move-in-canvas",
      title: "视口操作只服务于定位，不改变节点含义",
      summary: "缩放、平移和定位是为了找到目标，不会改动工作流结构。",
      keywords: ["缩放", "平移", "定位节点"],
      searchText:
        "缩放 平移 定位节点 视口 画布 文件视口 搜索节点 居中",
      blocks: [
        {
          type: "paragraph",
          text: "画布视口的缩放、平移和节点居中，解决的是“我现在要看哪里”。这些动作不会改变节点本身，只是帮助你在大图中快速找到目标位置。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
