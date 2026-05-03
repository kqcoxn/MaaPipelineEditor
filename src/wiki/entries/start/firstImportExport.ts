import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "first-import-export",
  title: "第一次导入与导出",
  summary: "第一次使用时，先理解导入来源、导出去向和与迁移场景的边界。",
  searchText:
    "第一次导入导出 导入 Pipeline 导出 Pipeline 导入配置 本地保存 迁移旧 Pipeline",
  steps: [
    {
      id: "know-import-sources",
      title: "先区分导入来源",
      summary: "导入既可以来自粘贴板，也可以来自文件或本地服务。",
      keywords: ["导入", "粘贴板", "文件", "本地服务"],
      searchText:
        "导入 粘贴板 文件 本地服务 LocalBridge 导入配置 导入旧 Pipeline",
      blocks: [
        {
          type: "paragraph",
          text: "导入按钮既能从粘贴板读取 Pipeline，也能从文件读取；连接 LocalBridge 后，文件导入会优先进入本地文件链路。若你的目标是把旧项目迁进来，请优先看迁移条目，而不是只把它当成普通导入。",
        },
      ],
    },
    {
      id: "export-destinations",
      title: "再决定导出去向",
      summary: "导出可以是临时分享、文件落盘或本地服务保存。",
      keywords: ["导出", "粘贴板", "文件导出", "本地保存"],
      searchText:
        "导出 粘贴板 文件导出 本地保存 分离导出 集成导出 部分导出",
      blocks: [
        {
          type: "paragraph",
          text: "导出按钮支持粘贴板、文件和本地服务保存。第一次使用时，先确认你要的是临时分享、落盘文件还是写回本地工作目录；这会直接影响后续版本管理和迁移方式。",
        },
        {
          type: "markdown",
          text: "更多细节见：[导入与导出](https://mpe.codax.site/docs/guide/core/persistence.html)。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
