import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "import-existing",
  title: "导入已有文件",
  summary: "导入旧 Pipeline 时，先理解兼容边界、字段限制和自动布局预期。",
  searchText:
    "导入已有文件 导入旧 Pipeline 兼容边界 自动布局 深层字段 前缀 旧项目迁移",
  steps: [
    {
      id: "check-compat",
      title: "先判断这是不是“迁移”而不是普通导入",
      summary: "旧项目的风险点通常在字段结构和连接语义。",
      keywords: ["导入旧 Pipeline", "迁移", "兼容"],
      searchText:
        "导入旧 Pipeline 迁移 兼容 旧项目 深层字段 连接语义",
      blocks: [
        {
          type: "paragraph",
          text: "如果你导入的是旧 Pipeline、历史项目或外部产物，不要把它简单看成“打开一个文件”。真正的风险点通常在字段结构、命名习惯和连接语义，所以它属于迁移场景，而不是普通导入。",
        },
      ],
    },
    {
      id: "accept-repair",
      title: "接受“导入后需要整理”的现实",
      summary: "自动布局和可视化还原不会替你理解原项目业务。",
      keywords: ["自动布局", "导入后整理"],
      searchText:
        "自动布局 导入后整理 旧文件 可视化还原 手动检查 迁移",
      blocks: [
        {
          type: "paragraph",
          text: "导入成功不代表迁移完成。自动布局只能帮你把关系理顺，不能替你理解旧项目真正的业务结构；因此导入后仍需要手动检查节点命名、分支顺序和关键字段。",
        },
        {
          type: "markdown",
          text: "完整迁移要求见：[导入已有文件](https://mpe.codax.site/docs/guide/migrate/old.html)。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
