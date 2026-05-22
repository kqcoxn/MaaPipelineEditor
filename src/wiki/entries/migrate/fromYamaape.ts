import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "from-yamaape",
  title: "从 YAMaaPE 迁移",
  summary: "从 YAMaaPE 迁移时，先确认字段兼容边界，再决定哪些内容要重整而不是原样照搬。",
  searchText:
    "YAMaaPE 迁移 字段兼容 旧字段 导入要求 旧项目迁移 MaaFramework 4.5 v1 v2 协议 特殊字段",
  steps: [
    {
      id: "check-field-era",
      title: "先确认旧字段属于哪个时代",
      summary: "YAMaaPE 兼容不等于所有历史字段都能原样沿用。",
      keywords: ["YAMaaPE", "字段兼容", "MaaFramework 4.5", "特殊字段"],
      searchText:
        "YAMaaPE 字段兼容 MaaFramework 4.5 历史字段 原样沿用 迁移前提 特殊字段 自动适配",
      blocks: [
        {
          type: "paragraph",
          text: "MPE 保留了对 YAMaaPE 特殊字段的兼容，导入时会自动解析并适配到新字段。但 MaaFramework 4.5 之前的字段格式需要先手动调整到 4.5+ 格式，才能被正确识别。",
        },
        {
          type: "callout",
          calloutType: "warning",
          title: "版本要求",
          text: "如果旧文件使用的是 MaaFramework 4.5 之前的字段格式，需要先按 MaaFramework 文档手动升级字段，再导入 MPE。",
        },
      ],
    },
    {
      id: "migration-steps",
      title: "迁移步骤",
      summary: "v1 协议导入 → 自动适配 → 后续用 v2。",
      keywords: ["迁移步骤", "v1", "v2", "协议"],
      searchText:
        "迁移步骤 v1协议 v2协议 导入 自动适配 后续使用 流程",
      blocks: [
        {
          type: "code",
          language: "text",
          text: "确认字段版本（需 4.5+）→ 用 v1 协议导入 Pipeline → MPE 自动解析 YAMaaPE 配置字段 → 后续使用 v2 协议导入导出",
        },
        {
          type: "paragraph",
          text: "迁移完成后，后续对该文件的导入导出都使用 v2 协议即可。不需要把整个项目一次性全部迁移——只有需要在 MPE 中编辑的文件才需要迁移。",
        },
      ],
    },
    {
      id: "scope-advice",
      title: "不需要全量迁移",
      summary: "只迁移需要编辑的文件，旧文件不动也没问题。",
      keywords: ["按需迁移", "单文件", "不影响旧文件"],
      searchText:
        "按需迁移 单文件 不影响旧文件 部分迁移 旧项目 不需要改动",
      blocks: [
        {
          type: "paragraph",
          text: "MPE 以单个 .json 文件为操作单位。如果旧文件不需要修改，完全不需要迁移到 MPE。只对需要编辑的文件执行迁移流程即可，不会影响项目中的其他文件。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
