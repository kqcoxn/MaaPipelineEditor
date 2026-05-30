import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "about-mpe",
  title: "介绍",
  summary: "了解 MPE 的定位、工作原理和核心特性。",
  searchText:
    "介绍 MPE 是什么 MaaPipelineExtremer Pipeline 编辑器 工作流 可视化 审阅 编辑 MaaFramework React ReactFlow 编译器 解析器 特性",
  steps: [
    {
      id: "what-is-mpe",
      title: "MPE 是什么",
      summary: "MPE 的核心定位是图形化编辑、整理和调试 MaaFramework Pipeline。",
      keywords: ["MPE 是什么", "Pipeline 编辑器", "MaaPipelineExtremer"],
      searchText:
        "MPE MaaPipelineExtremer Pipeline 编辑器 工作流 可视化 审阅 编辑 MaaFramework YAMaaPE 重构",
      blocks: [
        {
          type: "paragraph",
          text: "MaaPipelineExtremer (MPE) 是一款前后端完全分离架构的 MaaFramework Pipeline 工作流式可视化审阅与编辑工具，由 YAMaaPE 重构而来，经资源开发者充分实践与微调。",
        },
        {
          type: "paragraph",
          text: "MPE 最初是为了辅助构建 MNMA 项目，在持续迭代与完善中逐渐解耦，重构后已经可以兼容所有 MaaFramework 项目使用。",
        },
      ],
    },
    {
      id: "how-it-works",
      title: "它是如何工作的",
      summary: "前端基于 React + React Flow，通过编译器和解析器完成格式转换。",
      keywords: ["工作原理", "编译器", "解析器", "React Flow"],
      searchText:
        "工作原理 React ReactFlow 编译器 解析器 Pipeline V1 V2 JSON 导入 导出 节点 边",
      blocks: [
        {
          type: "paragraph",
          text: "MPE 前端使用 React 与 React Flow 作为主要业务解决方案。编辑过程中，MPE 会将流程图节点与边实时保存，在预览或导出时使用内置编译器转换为 Pipeline V2 格式 JSON。",
        },
        {
          type: "paragraph",
          text: "导入时，MPE 根据 Pipeline V1/V2 协议读取 JSON，通过内置解析器转换为流程图的节点与边，以继续编辑。开发时您无需关注 MPE 做了什么，仅需关注如何构建业务逻辑即可。",
        },
      ],
    },
    {
      id: "core-features",
      title: "核心特性",
      summary: "轻量即用、渐进扩展、阅读体验、全面辅助、AI 驱动、完整兼容。",
      keywords: ["特性", "轻量", "渐进", "AI", "兼容"],
      searchText:
        "特性 轻量 无需安装 渐进扩展 LocalBridge 阅读体验 节点风格 辅助工具 OCR 调试 AI 智能搜索 补全 MCP 兼容 迁移 v1 v2",
      blocks: [
        {
          type: "markdown",
          text: "- **轻量即用**：无需下载安装，打开在线编辑器即可开始可视化 Pipeline 编辑，真正意义跨平台\n- **渐进扩展**：一行命令即可增量启用本地服务，无缝接入文件管理、截图工具、流程调试等本地能力\n- **阅读体验**：多种节点样式、节点聚焦、关键路径高亮、可拖拽连接中点、便签与分组\n- **全面辅助**：内置识别小工具（OCR、截图裁剪、取色框选等）、流程化调试、丰富节点模板与自定义模板\n- **AI 驱动**：智能节点搜索、节点级 AI 补全、MCP 联动、探索模式\n- **完整兼容**：旧项目一键导入、自动字段迁移、v1/v2 协议混用、配置持久化",
        },
      ],
    },
  ],
};

export const searchIndex = createModuleSearchIndex(module);

export default module;
