import type { WikiEntryMeta, WikiTarget } from "./types";

export const wikiEntries: WikiEntryMeta[] = [
  {
    id: "start",
    title: "开始使用",
    summary: "用最短路径理解如何开始编辑、选择形态并完成第一次导入导出。",
    keywords: ["开始使用", "快速上手", "版本选择", "导入导出"],
    modules: [
      {
        id: "about-mpe",
        title: "认识 MPE",
        summary: "先理解 MPE 的定位，再决定你是来做编辑、调试还是迁移整理。",
        keywords: ["认识 MPE", "MPE 是什么", "Pipeline 编辑器"],
        loader: () => import("./entries/start/aboutMpe"),
      },
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
        id: "about-editor",
        title: "认识工作流编辑器",
        summary: "先建立对画布和主面板的整体认知，再深入具体编辑动作。",
        keywords: ["认识工作流编辑器", "画布", "工作流编辑器"],
        loader: () => import("./entries/workflow/aboutEditor"),
      },
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
        id: "node-templates",
        title: "节点模板",
        summary: "通过模板搜索、预览和粘贴板更快创建可复用节点结构。",
        keywords: ["节点模板", "搜索节点模板", "自定义模板"],
        loader: () => import("./entries/workflow/nodeTemplates"),
      },
      {
        id: "connection-panel",
        title: "连接面板与连接操作",
        summary: "理解连接类型、顺序和 JumpBack 等关键关系。",
        keywords: ["连接面板", "next", "on_error", "jumpback"],
        loader: () => import("./entries/workflow/connectionPanel"),
      },
      {
        id: "file-viewport",
        title: "文件与视口",
        summary: "区分标签页、本地文件和画布视口，减少大图编辑时的迷路感。",
        keywords: ["文件与视口", "标签页", "缩放", "平移"],
        loader: () => import("./entries/workflow/fileViewport"),
      },
      {
        id: "tools-search",
        title: "工具与搜索",
        summary: "把搜索和常用工具看作编辑加速器，而不是另一套主流程。",
        keywords: ["工具与搜索", "搜索节点", "节点列表"],
        loader: () => import("./entries/workflow/toolsSearch"),
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
        id: "color-pick",
        title: "颜色取点",
        summary: "从截图中读取颜色值，并快速回填到颜色相关字段。",
        keywords: ["颜色取点", "取色", "RGB", "HSV"],
        loader: () => import("./entries/toolbox/colorPick"),
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
      {
        id: "delta-measure",
        title: "位移测量",
        summary: "为单轴 `dx/dy` 参数提供直接的水平或垂直位移结果。",
        keywords: ["位移测量", "dx", "dy", "相对位移"],
        loader: () => import("./entries/toolbox/deltaMeasure"),
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
      {
        id: "timeline-artifacts",
        title: "时间线与产物",
        summary: "当节点线只能告诉你大概位置时，用事件线和图像产物继续向下追证据。",
        keywords: ["时间线", "事件线", "产物", "截图"],
        loader: () => import("./entries/debug/timelineArtifacts"),
      },
      {
        id: "troubleshooting",
        title: "调试排障",
        summary: "调试失败时，先按前置条件、证据和运行范围的顺序排查。",
        keywords: ["调试排障", "调试失败", "运行失败"],
        loader: () => import("./entries/debug/troubleshooting"),
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
      {
        id: "connection-prerequisites",
        title: "连接状态与前置条件",
        summary: "确认当前连接状态，以及还差哪一步才算真正可用。",
        keywords: ["连接状态", "前置条件", "连接失败"],
        loader: () => import("./entries/localbridge/connectionPrerequisites"),
      },
      {
        id: "local-files",
        title: "本地文件管理",
        summary: "通过 LocalBridge 访问真实工作目录，而不是只切换当前标签页。",
        keywords: ["本地文件管理", "本地文件", "工作目录"],
        loader: () => import("./entries/localbridge/localFiles"),
      },
      {
        id: "device-screenshot",
        title: "设备与截图前置",
        summary: "截图类工具能否工作，关键在于控制器和截图来源是否就绪。",
        keywords: ["设备与截图前置", "截图失败", "控制器"],
        loader: () => import("./entries/localbridge/deviceScreenshot"),
      },
      {
        id: "common-connection-issues",
        title: "常见连接问题",
        summary: "连接失败时，先从状态、方法配置和目标设备选择这三类问题切入。",
        keywords: ["常见连接问题", "连接失败", "切换设备"],
        loader: () => import("./entries/localbridge/commonConnectionIssues"),
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
      {
        id: "from-yamaape",
        title: "从 YAMaaPE 迁移",
        summary: "先确认字段兼容边界，再决定哪些内容要重整而不是原样照搬。",
        keywords: ["从 YAMaaPE 迁移", "字段兼容", "旧字段"],
        loader: () => import("./entries/migrate/fromYamaape"),
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
