import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "about-mpe",
  title: "认识 MPE",
  summary: "先理解 MPE 主要解决什么问题，再决定用它做编辑、调试还是迁移整理。",
  searchText:
    "认识 MPE MPE 是什么 Pipeline 编辑器 工作流编辑 调试 迁移 LocalBridge 在线版",
  steps: [
    {
      id: "what-is-mpe",
      title: "MPE 主要是做什么的",
      summary: "MPE 的核心定位是图形化编辑、整理和调试 Maa Pipeline。",
      keywords: ["MPE 是什么", "Pipeline 编辑器", "工作流编辑"],
      searchText:
        "MPE 是什么 Pipeline 编辑器 工作流编辑 节点 字段 连接 调试 迁移",
      blocks: [
        {
          type: "paragraph",
          text: "MPE 是面向 Maa Pipeline 的图形化编辑器。它把节点、字段、连接、导入导出和调试入口集中到同一套工作台里，适合处理新建流程、整理旧文件和定位运行问题。",
        },
        {
          type: "callout",
          calloutType: "info",
          title: "Docsite First",
          text: "这个模块只负责在应用内说明“它是什么、适合什么时候看”，不复制外部长文介绍。",
        },
      ],
    },
    {
      id: "when-to-use-which-surface",
      title: "先区分编辑、调试和本地能力",
      summary: "纯编辑、调试和本地文件操作，依赖的能力并不相同。",
      keywords: ["在线版", "LocalBridge", "本地能力"],
      searchText:
        "在线版 LocalBridge 本地能力 调试 文件管理 字段快捷工具 设备截图",
      blocks: [
        {
          type: "paragraph",
          text: "如果你只想改节点和字段，在线编辑能力通常已经够用；如果你需要本地文件管理、截图类工具或调试运行，就要继续看 LocalBridge 和调试模块。",
        },
        {
          type: "markdown",
          text: "完整介绍与背景说明见：[介绍](https://mpe.codax.site/docs/guide/start/introduction.html)。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
