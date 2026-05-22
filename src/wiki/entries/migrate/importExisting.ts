import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "import-existing",
  title: "导入已有文件",
  summary: "导入旧 Pipeline 时，先理解兼容边界、字段限制和自动布局预期。",
  searchText:
    "导入已有文件 导入旧 Pipeline 兼容边界 自动布局 深层字段 前缀 旧项目迁移 粘贴板 拖拽 v1 v2 extras",
  steps: [
    {
      id: "check-compat",
      title: "先判断这是不是“迁移”而不是普通导入",
      summary: "旧项目的风险点通常在字段结构和连接语义。",
      keywords: ["导入旧 Pipeline", "迁移", "兼容", "深层字段"],
      searchText:
        "导入旧 Pipeline 迁移 兼容 旧项目 深层字段 连接语义 extras 不可解析",
      blocks: [
        {
          type: "paragraph",
          text: "如果你导入的是旧 Pipeline、历史项目或外部产物，不要把它简单看成“打开一个文件”。真正的风险点通常在字段结构、命名习惯和连接语义，所以它属于迁移场景，而不是普通导入。",
        },
        {
          type: "callout",
          calloutType: "info",
          title: "不可解析的部分",
          text: "MPE 只支持节点根级别的自定义字段（通过 extras 字段）。深层嵌套的自定义字段在导入/导出时会丢失，需要提前评估影响。",
        },
      ],
    },
    {
      id: "import-methods",
      title: "三种导入方式",
      summary: "粘贴板、文件选择和拖拽都可以导入。",
      keywords: ["粘贴板", "文件", "拖拽", "v1", "v2"],
      searchText:
        "粘贴板 文件选择 拖拽 导入方式 v1 v2 自动检测 协议格式 混用",
      blocks: [
        {
          type: "markdown",
          text: "- **从粘贴板**：复制 JSON 内容后点击导入按钮\n- **从文件**：点击按钮选择文件\n- **拖拽**：直接拖拽 .json/.jsonc 文件到编辑器",
        },
        {
          type: "paragraph",
          text: "导入时自动检测 v1/v2 协议格式，支持同一文件中混用两种协议。MPE 以单个 .json 文件为操作单位。",
        },
      ],
    },
    {
      id: "accept-repair",
      title: "导入后整理：自动布局与前缀",
      summary: "自动布局和前缀兼容帮助初步整理，但不替代人工检查。",
      keywords: ["自动布局", "前缀", "导入后整理"],
      searchText:
        "自动布局 前缀 导入后整理 旧文件 可视化还原 手动检查 统一前缀 $__mpe_config_",
      blocks: [
        {
          type: "paragraph",
          text: "导入成功后，点击右下角自动布局工具可以根据连接关系自动排列节点。注意自动布局只能“理顺”连接，不理解业务逻辑，复杂分支/合并可能布局不理想。",
        },
        {
          type: "paragraph",
          text: "如果旧文件使用了统一前缀，MPE 会自动识别并转换为内部前缀配置（$__mpe_config_ 节点）。导入后仍需手动检查节点命名、分支顺序和关键字段是否正确。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
