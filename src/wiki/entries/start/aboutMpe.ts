import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "about-mpe",
  title: "认识 MPE",
  summary: "先理解 MPE 主要解决什么问题，再决定用它做编辑、调试还是迁移整理。",
  searchText:
    "认识 MPE MPE 是什么 Pipeline 编辑器 工作流编辑 调试 迁移 LocalBridge 在线版 MaaPipelineExtremer 特性 轻量 渐进 AI 兼容",
  steps: [
    {
      id: "what-is-mpe",
      title: "MPE 主要是做什么的",
      summary: "MPE 的核心定位是图形化编辑、整理和调试 Maa Pipeline。",
      keywords: ["MPE 是什么", "Pipeline 编辑器", "工作流编辑"],
      searchText:
        "MPE 是什么 Pipeline 编辑器 工作流编辑 节点 字段 连接 调试 迁移 MaaPipelineExtremer React ReactFlow",
      blocks: [
        {
          type: "paragraph",
          text: "MPE（MaaPipelineExtremer）是面向 MaaFramework Pipeline 的图形化审阅与编辑工具。它把节点、字段、连接、导入导出和调试入口集中到同一套工作台里，适合处理新建流程、整理旧文件和定位运行问题。",
        },
        {
          type: "paragraph",
          text: "底层基于 React + React Flow 构建，采用前后端完全解耦架构：前端负责编辑与渲染，后端（LocalBridge）提供本地文件、设备交互和调试能力。",
        },
      ],
    },
    {
      id: "core-features",
      title: "了解核心特性",
      summary: "MPE 围绕轻量、渐进扩展、阅读体验、辅助工具、AI 和兼容性设计。",
      keywords: ["特性", "轻量", "AI", "兼容"],
      searchText:
        "轻量 渐进扩展 阅读体验 辅助工具 AI 兼容 节点风格 路径高亮 模板 MCP 探索模式 v1 v2 协议",
      blocks: [
        {
          type: "markdown",
          text: "- **轻量即用**：无需下载安装，打开在线版即可开始编辑\n- **渐进扩展**：一条命令启用本地服务，获得文件管理、截图和调试能力\n- **阅读体验**：多种节点风格、节点聚焦、关键路径高亮、便签与分组\n- **全面辅助**：内置识别工具、可视化调试、丰富节点模板与自定义模板\n- **AI 驱动**：智能节点搜索、节点级 AI 补全、MCP 集成、探索模式\n- **完整兼容**：一键导入旧项目、自动字段迁移、v1/v2 协议混用、配置持久化",
        },
      ],
    },
    {
      id: "when-to-use-which-surface",
      title: "先区分编辑、调试和本地能力",
      summary: "纯编辑、调试和本地文件操作，依赖的能力并不相同。",
      keywords: ["在线版", "LocalBridge", "本地能力", "MaaInspector", "YAMaaPE"],
      searchText:
        "在线版 LocalBridge 本地能力 调试 文件管理 字段快捷工具 设备截图 MaaInspector YAMaaPE 对比",
      blocks: [
        {
          type: "paragraph",
          text: "如果你只想改节点和字段，在线编辑能力通常已经够用；如果你需要本地文件管理、截图类工具或调试运行，就要继续看 LocalBridge 和调试模块。",
        },
        {
          type: "callout",
          calloutType: "info",
          title: "与其他工具的关系",
          text: "MaaInspector 侧重运行时调试与设备交互，YAMaaPE 是早期编辑器。MPE 在编辑体验和渐进式能力扩展上做了重新设计，同时保留了对旧项目的导入兼容。",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
