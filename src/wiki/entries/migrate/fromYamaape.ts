import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "from-yamaape",
  title: "从 YAMaaPE 迁移",
  summary: "从 YAMaaPE 迁移时，先确认字段兼容边界，再决定哪些内容要重整而不是原样照搬。",
  searchText:
    "YAMaaPE 迁移 字段兼容 旧字段 导入要求 旧项目迁移 MaaFramework 4.5",
  steps: [
    {
      id: "check-field-era",
      title: "先确认旧字段属于哪个时代",
      summary: "YAMaaPE 兼容不等于所有历史字段都能原样沿用。",
      keywords: ["YAMaaPE", "字段兼容", "MaaFramework 4.5"],
      searchText:
        "YAMaaPE 字段兼容 MaaFramework 4.5 历史字段 原样沿用 迁移前提",
      blocks: [
        {
          type: "paragraph",
          text: "MPE 仍保留对 YAMaaPE 特殊字段的兼容，但这不代表所有历史字段都能原样沿用。遇到较早期字段或命名方式时，仍应先对照当前导入要求判断哪些需要手动调整。",
        },
      ],
    },
    {
      id: "migrate-with-summary",
      title: "在 MPE 里保留摘要，长说明继续留给 docsite",
      summary: "本条目只负责迁移前提、风险和跳转，不复制完整历史背景。",
      keywords: ["迁移前提", "跳转", "外部长文"],
      searchText:
        "迁移前提 外部长文 跳转 YAMaaPE 旧协议 历史背景",
      blocks: [
        {
          type: "paragraph",
          text: "应用内 Wiki 只负责帮助你判断“现在能不能迁、迁完先看什么”；更长的历史背景、协议差异和完整导入说明继续保留在 docsite，不在这里复制第二份长文。",
        },
        {
          type: "markdown",
          text: "完整说明见：[从 YAMaaPE 迁移](https://mpe.codax.site/docs/guide/migrate/yamaape.html) 与 [导入已有文件](https://mpe.codax.site/docs/guide/migrate/old.html)。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
