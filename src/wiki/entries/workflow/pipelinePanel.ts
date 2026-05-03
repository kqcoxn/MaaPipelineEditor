import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "pipeline-panel",
  title: "Pipeline 面板",
  summary: "Pipeline 面板是当前文件、标签页与本地文件入口的主操作面。",
  searchText:
    "Pipeline 面板 文件标签 文件名 本地文件 标签页 切换文件 当前 Pipeline",
  steps: [
    {
      id: "manage-current-file",
      title: "当前文件和标签页",
      summary: "先理解你现在编辑的是哪个文件，再进行导入导出或调试。",
      keywords: ["当前文件", "标签页", "文件名"],
      searchText:
        "当前文件 标签页 文件名 切换文件 Pipeline 面板 文件配置",
      blocks: [
        {
          type: "paragraph",
          text: "Pipeline 面板和文件标签页决定你当前操作的目标文件。导入、导出、调试、模板复用等动作都会默认围绕当前文件生效，因此切换前先确认标签页和文件名。",
        },
      ],
    },
    {
      id: "open-local-files",
      title: "需要本地文件时再进入 LocalBridge 链路",
      summary: "本地文件按钮是 LocalBridge 文件能力的入口，而不是普通标签页操作。",
      keywords: ["本地文件", "LocalBridge", "文件面板"],
      searchText:
        "本地文件 LocalBridge 文件面板 打开本地目录 文件列表 Pipeline 面板",
      blocks: [
        {
          type: "paragraph",
          text: "标签页适合在已打开的文件之间切换；右侧的本地文件入口则属于 LocalBridge 能力，用于进入本地目录、读取真实文件和写回工作区。不要把这两者混成同一层级理解。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
