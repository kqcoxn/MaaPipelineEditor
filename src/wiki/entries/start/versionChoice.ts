import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "version-choice",
  title: "版本选择",
  summary: "快速判断在线版、LocalBridge 增强版和本地一体包分别适合什么场景。",
  searchText:
    "版本选择 产品矩阵 在线版 LocalBridge 本地一体包 Extremer stable preview 设备连接 调试 功能对比 迁移",
  steps: [
    {
      id: "editor-only",
      title: "只做编辑时选在线版",
      summary: "不依赖本地能力时，在线版是启动成本最低的入口。",
      keywords: ["在线版", "纯前端", "无需安装"],
      searchText: "在线版 纯前端 浏览器 编辑 Pipeline 无需安装 临时编辑",
      blocks: [
        {
          type: "paragraph",
          text: "如果你只需要编辑 Pipeline、验证结构和导入导出，在线版启动成本最低——打开浏览器即可使用，无需安装任何东西。它不提供本地文件、截图工具和流程调试等需要本地能力的功能。",
        },
        {
          type: "paragraph",
          text: "适合场景：临时编辑、快速分享、团队协作审阅、不方便安装软件的环境。",
        },
      ],
    },
    {
      id: "need-local-runtime",
      title: "需要本地能力时加 LocalBridge 或一体包",
      summary: "字段工具、文件管理和调试都属于本地能力。",
      keywords: ["LocalBridge", "本地能力", "调试", "文件管理", "Extremer"],
      searchText:
        "LocalBridge 本地能力 调试 文件管理 字段快捷工具 一体包 Extremer 桌面应用",
      blocks: [
        {
          type: "paragraph",
          text: "当你需要截图、OCR、模板截图、本地文件管理或流程调试时，就不再是纯前端场景。此时有两种选择：",
        },
        {
          type: "markdown",
          text: "- **Web + LocalBridge**：在线版 + 一条命令启动本地服务，灵活度最高，适合日常开发\n- **Extremer（本地一体包）**：桌面应用，开箱即用，无需手动配置，适合不想折腾的用户",
        },
      ],
    },
    {
      id: "feature-comparison",
      title: "功能对比速查",
      summary: "三种模式在功能完整度、上手难度和灵活性上各有取舍。",
      keywords: ["功能对比", "完整度", "难度"],
      searchText:
        "功能对比 完整度 难度 灵活性 文件管理 字段工具 调试 AI 设备连接",
      blocks: [
        {
          type: "markdown",
          text: "| 能力 | 纯 Web | Web + LB | 一体包 |\n|------|--------|----------|--------|\n| Pipeline 编辑 | ✅ | ✅ | ✅ |\n| 本地文件管理 | ❌ | ✅ | ✅ |\n| 字段快捷工具 | ❌ | ✅ | ✅ |\n| 流程调试 | ❌ | ✅ | ✅ |\n| AI 辅助 | ❌ | ✅ | ✅ |\n| 上手难度 | 最低 | 中等 | 低 |\n| 灵活性 | 高 | 最高 | 中等 |",
        },
      ],
    },
    {
      id: "how-to-choose",
      title: "如何选择",
      summary: "根据使用场景快速决策。",
      keywords: ["选择", "场景", "建议"],
      searchText:
        "如何选择 初次使用 日常开发 团队协作 多项目 迁移 切换",
      blocks: [
        {
          type: "markdown",
          text: "- **初次使用**：先用在线版体验编辑流程，有需要再加 LocalBridge\n- **日常开发**：Web + LocalBridge，灵活且功能完整\n- **不想配置**：直接用一体包\n- **团队协作**：在线版分享链接 + 各自本地 LocalBridge 调试",
        },
        {
          type: "callout",
          calloutType: "info",
          title: "模式可随时切换",
          text: "三种模式的 Pipeline 文件完全通用，随时可以从纯 Web 切换到 LocalBridge 模式，或反过来。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
