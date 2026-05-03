import type { WikiEntryMeta, WikiTarget } from "./types";

export const wikiEntries: WikiEntryMeta[] = [
  {
    id: "start",
    title: "开始使用",
    summary: "用最短路径理解如何开始编辑、选择形态并完成第一次导入导出。",
    keywords: ["开始使用", "快速上手", "版本选择", "导入导出"],
    modules: [
      {
        id: "quick-start",
        title: "5 分钟上手",
        summary: "先理解如何快速开始、创建节点、连接流程和编辑关键字段。",
        keywords: ["5 分钟上手", "快速上手", "创建节点"],
        loader: () => import("./entries/start/quickStart"),
      },
      {
        id: "version-choice",
        title: "版本选择",
        summary: "判断在线版、LocalBridge 和本地一体包分别适合什么场景。",
        keywords: ["产品矩阵", "在线版", "LocalBridge"],
        loader: () => import("./entries/start/versionChoice"),
      },
      {
        id: "first-import-export",
        title: "第一次导入与导出",
        summary: "先理解导入来源、导出去向和迁移边界。",
        keywords: ["导入导出", "导入", "导出"],
        loader: () => import("./entries/start/firstImportExport"),
      },
    ],
  },
  {
    id: "workflow",
    title: "工作流编辑",
    summary: "围绕节点、字段、连接、Pipeline 和导入导出完成基础编辑闭环。",
    keywords: ["工作流编辑", "节点", "字段面板", "连接", "Pipeline 面板"],
    modules: [
      {
        id: "nodes",
        title: "节点",
        summary: "理解节点创建、复用和节点侧调试入口。",
        keywords: ["节点", "节点模板", "从节点运行"],
        loader: () => import("./entries/workflow/nodes"),
      },
      {
        id: "field-panel",
        title: "字段面板",
        summary: "在字段面板里编辑关键字段，并借助快捷工具处理图像类字段。",
        keywords: ["字段面板", "关键字段", "邻接信息"],
        loader: () => import("./entries/workflow/fieldPanel"),
      },
      {
        id: "connection-panel",
        title: "连接面板与连接操作",
        summary: "理解连接类型、顺序和 JumpBack 等关键关系。",
        keywords: ["连接面板", "next", "on_error", "jumpback"],
        loader: () => import("./entries/workflow/connectionPanel"),
      },
      {
        id: "pipeline-panel",
        title: "Pipeline 面板",
        summary: "管理当前文件、标签页和本地文件入口。",
        keywords: ["Pipeline 面板", "文件标签", "本地文件"],
        loader: () => import("./entries/workflow/pipelinePanel"),
      },
      {
        id: "import-export",
        title: "导入与导出",
        summary: "理解导入导出的常见入口、配置模式和本地服务关系。",
        keywords: ["导入与导出", "分离导出", "部分导出"],
        loader: () => import("./entries/workflow/importExport"),
      },
    ],
  },
  {
    id: "toolbox",
    title: "工具箱",
    summary: "围绕截图、OCR、ROI 和偏移测量完成图像类字段配置闭环。",
    keywords: ["工具箱", "OCR", "模板截图", "ROI", "偏移测量"],
    modules: [
      {
        id: "ocr",
        title: "OCR",
        summary: "从截图中读取文本，并快速回填 expected 等字段。",
        keywords: ["OCR", "文字识别", "expected"],
        loader: () => import("./entries/toolbox/ocr"),
      },
      {
        id: "roi",
        title: "ROI",
        summary: "理解 ROI 框选、识别范围和负坐标。",
        keywords: ["ROI", "范围", "坐标", "偏移"],
        loader: () => import("./entries/toolbox/roi"),
      },
      {
        id: "template-screenshot",
        title: "模板截图",
        summary: "为模板类字段生成截图素材，并与 ROI、OCR 共用图像上下文。",
        keywords: ["模板截图", "模板裁剪", "绿幕"],
        loader: () => import("./entries/toolbox/templateScreenshot"),
      },
      {
        id: "roi-offset",
        title: "偏移测量",
        summary: "为 roi_offset、dx/dy 一类相对位移字段提供基准值。",
        keywords: ["偏移测量", "roi_offset", "dx", "dy"],
        loader: () => import("./entries/toolbox/roiOffset"),
      },
    ],
  },
  {
    id: "debug",
    title: "调试",
    summary: "围绕调试工作台、前置条件和运行方式完成基础调试闭环。",
    keywords: ["调试", "FlowScope", "调试前置条件", "从节点运行"],
    modules: [
      {
        id: "workbench",
        title: "调试工作台",
        summary: "发起运行、查看摘要，并在节点线和事件线中定位问题。",
        keywords: ["调试工作台", "中控台", "节点线", "事件线"],
        loader: () => import("./entries/debug/workbench"),
      },
      {
        id: "prerequisites",
        title: "调试前置条件",
        summary: "确认 LocalBridge、控制器、资源和截图来源是否就绪。",
        keywords: ["调试前置条件", "LocalBridge", "控制器", "资源路径"],
        loader: () => import("./entries/debug/prerequisites"),
      },
      {
        id: "run-modes",
        title: "运行方式",
        summary: "根据问题粒度选择整图运行、从节点运行、单节点运行、仅识别或仅动作。",
        keywords: ["运行方式", "从节点运行", "仅识别", "仅动作"],
        loader: () => import("./entries/debug/runModes"),
      },
    ],
  },
  {
    id: "localbridge",
    title: "本地能力",
    summary: "理解何时需要 LocalBridge，以及它和在线编辑边界的区别。",
    keywords: ["本地能力", "LocalBridge", "文件管理", "调试"],
    modules: [
      {
        id: "why-localbridge",
        title: "何时需要 LocalBridge",
        summary: "区分纯编辑场景和本地能力场景。",
        keywords: ["何时需要 LocalBridge", "在线版", "文件管理"],
        loader: () => import("./entries/localbridge/whyLocalBridge"),
      },
    ],
  },
  {
    id: "migrate",
    title: "迁移",
    summary: "理解旧项目导入、统一前缀和自动布局的迁移边界。",
    keywords: ["迁移", "导入旧 Pipeline", "统一前缀", "自动布局"],
    modules: [
      {
        id: "import-existing",
        title: "导入已有文件",
        summary: "旧 Pipeline 的导入更接近迁移，而不是普通打开文件。",
        keywords: ["导入已有文件", "导入旧 Pipeline", "兼容边界"],
        loader: () => import("./entries/migrate/importExisting"),
      },
      {
        id: "prefix-layout",
        title: "统一前缀与自动布局",
        summary: "迁移后的第一轮整理，优先处理前缀、命名和自动布局预期。",
        keywords: ["统一前缀", "自动布局", "命名修复"],
        loader: () => import("./entries/migrate/prefixLayout"),
      },
    ],
  },
];

export function getFirstWikiTarget() {
  const entry = wikiEntries[0];
  const module = entry?.modules[0];
  return entry
    ? {
        entryId: entry.id,
        moduleId: module?.id,
      }
    : undefined;
}

export function findWikiEntry(entryId?: string) {
  if (!entryId) return undefined;
  return wikiEntries.find((entry) => entry.id === entryId);
}

export function findWikiModuleMeta(entryId?: string, moduleId?: string) {
  const entry = findWikiEntry(entryId);
  if (!entry) return undefined;
  return moduleId
    ? entry.modules.find((module) => module.id === moduleId)
    : entry.modules[0];
}

export function isWikiTargetAvailable(target?: WikiTarget) {
  if (!target) return false;
  const entry = findWikiEntry(target.entryId);
  if (!entry) return false;
  if (!target.moduleId) return true;
  return entry.modules.some((module) => module.id === target.moduleId);
}

export function normalizeWikiTarget(target?: WikiTarget): WikiTarget | undefined {
  if (!target) return undefined;
  const entry = findWikiEntry(target.entryId);
  if (!entry) return undefined;
  const moduleMeta = findWikiModuleMeta(target.entryId, target.moduleId);
  if (target.moduleId && !moduleMeta) return undefined;
  return {
    entryId: entry.id,
    moduleId: moduleMeta?.id,
    stepId: target.stepId,
  };
}
