import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "version-choice",
  title: "版本选择",
  summary: "快速判断在线版、LocalBridge 增强版和本地一体包分别适合什么场景。",
  searchText:
    "版本选择 产品矩阵 在线版 LocalBridge 本地一体包 stable preview 设备连接 调试",
  steps: [
    {
      id: "editor-only",
      title: "只做编辑时选在线版",
      summary: "不依赖本地能力时，在线版是启动成本最低的入口。",
      keywords: ["在线版", "纯前端"],
      searchText: "在线版 纯前端 浏览器 编辑 Pipeline 无需安装",
      blocks: [
        {
          type: "paragraph",
          text: "如果你只需要编辑 Pipeline、验证结构和导入导出，在线版启动成本最低。它不提供本地文件、截图工具和流程调试等需要本地能力的功能。",
        },
      ],
    },
    {
      id: "need-local-runtime",
      title: "需要本地能力时加 LocalBridge 或一体包",
      summary: "字段工具、文件管理和调试都属于本地能力。",
      keywords: ["LocalBridge", "本地能力", "调试", "文件管理"],
      searchText:
        "LocalBridge 本地能力 调试 文件管理 字段快捷工具 一体包",
      blocks: [
        {
          type: "paragraph",
          text: "当你需要截图、OCR、模板截图、LocalBridge 文件管理或流程调试时，就不再是纯前端场景。此时应连接 LocalBridge，或直接使用带完整运行时的一体包。",
        },
        {
          type: "markdown",
          text: "完整对比见：[产品矩阵](https://mpe.codax.site/docs/guide/start/product-matrix.html)。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
