import type { WikiModule } from "../../types";
import { createModuleSearchIndex } from "../../searchHelpers";

const module: WikiModule = {
  id: "version-choice",
  title: "产品矩阵",
  summary: "对比纯 Web、Web + LocalBridge 和本地一体包三种部署模式的功能与适用场景。",
  searchText:
    "产品矩阵 部署模式 纯 Web LocalBridge Extremer 本地一体包 功能对比 适用场景 渐进增强",
  steps: [
    {
      id: "overview",
      title: "渐进增强的产品设计",
      summary: "三种部署模式满足不同使用场景。",
      keywords: ["渐进增强", "部署模式", "概述"],
      searchText:
        "渐进增强 部署模式 纯 Web 端 Web LocalBridge Extremer 本地一体包 上手难度 功能完整度 便捷性 灵活性",
      blocks: [
        {
          type: "paragraph",
          text: "MPE 采用渐进增强的产品设计理念，提供三种部署模式：纯 Web 端（无需安装，开箱即用）、Web + LocalBridge（本地能力扩展）、本地一体包 Extremer（开箱即用的桌面应用）。",
        },
        {
          type: "markdown",
          text: "| 维度 | 纯 Web 端 | Web + LB | Extremer |\n|------|-----------|----------|----------|\n| 上手难度 | 最低 | 中等 | 低 |\n| 功能完整度 | 基础 | 完整 | 完整 |\n| 使用便捷性 | 高 | 中等 | 高 |\n| 配置灵活性 | 低 | 最高 | 中等 |\n| 适用场景 | 临时/查看 | 多实例开发 | 日常使用 |",
        },
      ],
    },
    {
      id: "feature-matrix",
      title: "功能支持矩阵",
      summary: "各模式在编辑、文件、工具、调试和 AI 方面的支持情况。",
      keywords: ["功能对比", "支持矩阵"],
      searchText:
        "功能支持 编辑 文件管理 截图 OCR 调试 AI 设备连接 配置持久化 自动更新",
      blocks: [
        {
          type: "markdown",
          text: "| 功能 | 纯 Web | Web + LB | Extremer |\n|------|--------|----------|----------|\n| 可视化节点编辑与布局 | ✅ | ✅ | ✅ |\n| 协议兼容 (v1/v2) | ✅ | ✅ | ✅ |\n| 自定义节点模板 | ✅ | ✅ | ✅ |\n| 粘贴板导入/导出 | ✅ | ✅ | ✅ |\n| 本地文件扫描与监听 | ❌ | ✅ | ✅ |\n| 设备连接 (ADB/Win32) | ❌ | ✅ | ✅ |\n| 截图/OCR/取色/区域选择 | ❌ | ✅ | ✅ |\n| 流程调试与节点级运行 | ❌ | ✅ | ✅ |\n| AI 节点补全 | ❌ | ✅ | ✅ |\n| 配置持久化 | 浏览器 | 浏览器 | 本地文件 |",
        },
      ],
    },
    {
      id: "web-only",
      title: "纯 Web 端",
      summary: "无需安装，适合临时编辑、快速分享和协作审阅。",
      keywords: ["纯 Web", "在线版", "无需安装"],
      searchText:
        "纯 Web 端 在线版 无需安装 浏览器 跨平台 零配置 临时编辑 分享 协作 审阅",
      blocks: [
        {
          type: "markdown",
          text: "**适用场景：**\n- 快速查看和审阅他人的 Pipeline 项目\n- 临时编辑或创建简单的 Pipeline 配置\n- 在任意设备上进行轻量级编辑\n- 无需本地环境的协作场景\n\n**特点：** 无需安装，打开浏览器即可使用，真正跨平台。\n\n**限制：** 无法访问本地文件系统，无法使用截图、OCR、调试等本地能力。",
        },
      ],
    },
    {
      id: "web-plus-lb",
      title: "Web + LocalBridge",
      summary: "在 Web 端基础上增量启用本地能力，灵活度最高。",
      keywords: ["LocalBridge", "本地服务", "渐进增强"],
      searchText:
        "Web LocalBridge 本地服务 渐进增强 文件管理 截图 OCR 调试 设备连接 一行命令 灵活配置",
      blocks: [
        {
          type: "markdown",
          text: "**适用场景：**\n- 日常 Pipeline 资源开发工作\n- 需要频繁调试和测试流程\n- 多项目/多文件同时维护\n- 对配置灵活性有要求的开发场景\n\n**核心能力：**\n- 文件管理：递归扫描项目文件，实时监听变化，自动同步\n- MaaFramework 集成：原生 OCR、自动截图、完整运行与调试\n- 资源管理：图片预览、快速选择、跨文件跳转\n\n**启动方式：** 一行命令即可开启本地服务，前后端完全解耦。",
        },
      ],
    },
    {
      id: "extremer",
      title: "本地一体包 (Extremer)",
      summary: "开箱即用的桌面应用，内置 LocalBridge，无需手动配置。",
      keywords: ["Extremer", "本地一体包", "桌面应用"],
      searchText:
        "Extremer 本地一体包 桌面应用 开箱即用 一键启动 Wails 自动管理 可视化 日志",
      blocks: [
        {
          type: "markdown",
          text: "**适用场景：**\n- 希望开箱即用的用户\n- 不熟悉命令行操作的用户\n- 追求极致便捷的开发体验\n\n**核心优势：**\n- 一键启动，无需任何配置\n- 内嵌 LocalBridge 服务自动启动和管理\n- 前端日志窗口，实时查看服务状态\n- 基于 Wails v2 框架构建，前端与 Web 版完全一致",
        },
      ],
    },
    {
      id: "how-to-choose",
      title: "如何选择",
      summary: "根据使用场景快速决策。",
      keywords: ["选择", "建议", "迁移"],
      searchText:
        "如何选择 初次使用 日常开发 团队协作 迁移 切换 兼容 Pipeline 文件通用",
      blocks: [
        {
          type: "markdown",
          text: "- **初次使用 / 学习阶段**：先用纯 Web 端体验编辑流程\n- **日常资源开发**：推荐 Extremer（开箱即用）或 Web + LB（灵活配置）\n- **团队协作 / 代码审阅**：纯 Web 端通过分享链接快速展示\n- **多项目维护**：Web + LB 可灵活切换工作目录",
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
