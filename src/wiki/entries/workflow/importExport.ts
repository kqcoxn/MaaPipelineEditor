import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "import-export",
  title: "导入与导出",
  summary: "理解导入导出的常见入口、配置模式和与本地服务的关系。",
  searchText:
    "导入与导出 导入 Pipeline 导出 Pipeline 配置文件 分离导出 集成导出 本地保存 部分导出 粘贴板 拖拽 v1 v2 协议",
  steps: [
    {
      id: "config-schemes",
      title: "先理解三种配置处理方案",
      summary: "集成、分离和不导出配置，决定了文件结构。",
      keywords: ["集成导出", "分离导出", "不导出配置"],
      searchText:
        "集成导出 分离导出 不导出配置 __mpe_config__ .mpe.json 配置方案 版本管理",
      blocks: [
        {
          type: "markdown",
          text: "- **集成导出**：配置嵌入 Pipeline 文件的 `__mpe_config__` 字段，单文件即完整，适合持续用 MPE 开发\n- **分离导出**：Pipeline 文件保持纯净代码，配置存入 `.filename.mpe.json`，适合版本管理和团队协作\n- **不导出配置**：只保存纯 Pipeline 代码，再次导入时自动布局",
        },
      ],
    },
    {
      id: "import-paths",
      title: "导入支持多种来源",
      summary: "粘贴板、文件选择、拖拽和本地服务都可以导入。",
      keywords: ["导入", "粘贴板", "拖拽", "本地服务", "v1", "v2"],
      searchText:
        "普通导入 迁移导入 旧 Pipeline 导入已有文件 粘贴板 文件 拖拽 本地服务 v1 v2 自动检测",
      blocks: [
        {
          type: "markdown",
          text: "- **从粘贴板**：复制 JSON 内容后点击导入按钮\n- **从文件**：点击按钮选择文件，或直接拖拽文件到编辑器\n- **从本地服务**：通过 LocalBridge 文件列表打开（推荐）",
        },
        {
          type: "paragraph",
          text: "导入时自动检测 v1/v2 协议格式，支持同一文件中混用两种协议。如果是旧项目或 YAMaaPE 文件，请参考迁移模块了解兼容边界。",
        },
      ],
    },
    {
      id: "export-modes",
      title: "导出方式与部分导出",
      summary: "全量导出到粘贴板或文件，也可以框选节点做部分导出。",
      keywords: ["部分导出", "粘贴板导出", "文件导出", "本地保存"],
      searchText:
        "部分导出 粘贴板导出 文件导出 本地保存 框选节点 LocalBridge 下载",
      blocks: [
        {
          type: "paragraph",
          text: "导出方式：复制到粘贴板（适合快速粘贴到项目）、下载为文件、或通过 LocalBridge 直接保存到本地目录。框选部分节点后导出，只会包含选中节点及其连接关系。",
        },
        {
          type: "callout",
          calloutType: "info",
          title: "分离导出的文件",
          text: "分离模式下可选择导出：两个文件都导出、仅 Pipeline 文件、或仅配置文件。配置文件名以 . 开头，默认隐藏。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
