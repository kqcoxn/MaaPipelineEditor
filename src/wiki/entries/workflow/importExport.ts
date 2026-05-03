import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "import-export",
  title: "导入与导出",
  summary: "理解导入导出的常见入口、配置模式和与本地服务的关系。",
  searchText:
    "导入与导出 导入 Pipeline 导出 Pipeline 配置文件 分离导出 本地保存 部分导出",
  steps: [
    {
      id: "import-paths",
      title: "导入有两条路径：普通导入与迁移导入",
      summary: "普通导入适合继续编辑，迁移导入适合接手旧项目。",
      keywords: ["导入", "迁移", "旧 Pipeline"],
      searchText:
        "普通导入 迁移导入 旧 Pipeline 导入已有文件 粘贴板 文件",
      blocks: [
        {
          type: "paragraph",
          text: "如果文件本身已经符合当前工作方式，直接导入即可；如果你接手的是旧 Pipeline 或 YAMaaPE 项目，请转到迁移条目理解前缀、自动布局和兼容边界，再决定怎么导入。",
        },
      ],
    },
    {
      id: "export-modes",
      title: "先确认导出模式，再决定去向",
      summary: "集成导出、分离导出和本地保存的语义不同。",
      keywords: ["集成导出", "分离导出", "本地保存"],
      searchText:
        "集成导出 分离导出 本地保存 配置导出 Pipeline 导出 部分导出",
      blocks: [
        {
          type: "paragraph",
          text: "在开始导出前，先确认你是在做临时分享、生成文件，还是写回本地工作目录。尤其在分离导出模式下，Pipeline 和配置会拆成不同载体，适合版本管理但也更需要明确去向。",
        },
        {
          type: "markdown",
          text: "完整行为说明见：[导入与导出](https://mpe.codax.site/docs/guide/core/persistence.html)。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
