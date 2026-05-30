import type { WikiEntryMeta, WikiTarget } from "./types";

export const wikiEntries: WikiEntryMeta[] = [
  {
    id: "start",
    title: "开始使用",
    summary: "了解 MPE 的定位与特性，跟随教程快速上手，并选择适合的部署模式。",
    keywords: ["开始使用", "介绍", "快速上手", "产品矩阵"],
    modules: [
      {
        id: "about-mpe",
        title: "介绍",
        summary: "了解 MPE 的定位、工作原理和核心特性。",
        keywords: ["介绍", "MPE 是什么", "Pipeline 编辑器", "特性"],
        loader: () => import("./entries/start/aboutMpe"),
      },
      {
        id: "quick-start",
        title: "快速上手",
        summary: "从零开始创建节点、连接流程、编辑字段并导出第一个 Pipeline。",
        keywords: ["快速上手", "教程", "创建节点", "导出"],
        loader: () => import("./entries/start/quickStart"),
      },
      {
        id: "version-choice",
        title: "产品矩阵",
        summary: "对比纯 Web、Web + LocalBridge 和本地一体包三种部署模式。",
        keywords: ["产品矩阵", "在线版", "LocalBridge", "Extremer"],
        loader: () => import("./entries/start/versionChoice"),
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
    summary:
      "FlowScope 调试工作台：九面板覆盖运行控制、执行追踪、产物查看和诊断排障。",
    keywords: ["调试", "FlowScope", "中控台", "节点线", "事件线", "诊断"],
    modules: [
      {
        id: "workbench",
        title: "调试工作台",
        summary:
          "FlowScope 九面板总览：中控台、节点线、事件线、AI总结、性能、图像、诊断、资源体检、调试配置。",
        keywords: ["FlowScope", "调试工作台", "中控台", "面板"],
        loader: () => import("./entries/debug/workbench"),
      },
      {
        id: "prerequisites",
        title: "调试前置条件",
        summary: "确认 LocalBridge、控制器、资源路径和截图来源是否就绪。",
        keywords: ["调试前置条件", "LocalBridge", "控制器", "资源体检"],
        loader: () => import("./entries/debug/prerequisites"),
      },
      {
        id: "run-modes",
        title: "运行方式",
        summary:
          "从节点运行、单节点运行、仅识别、仅动作四种方式加回放模式。",
        keywords: ["运行方式", "从节点运行", "仅识别", "仅动作", "回放"],
        loader: () => import("./entries/debug/runModes"),
      },
      {
        id: "timeline-artifacts",
        title: "事件线与产物",
        summary:
          "用事件线按 seq 追踪顺序，用图像面板和产物核对证据。",
        keywords: ["事件线", "产物", "图像", "截图", "回放"],
        loader: () => import("./entries/debug/timelineArtifacts"),
      },
      {
        id: "troubleshooting",
        title: "调试排障",
        summary:
          "按前置条件、诊断面板、资源体检和运行范围的顺序排查问题。",
        keywords: ["调试排障", "诊断", "资源体检", "AI总结"],
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
    id: "ai",
    title: "AI 辅助",
    summary: "围绕节点预测、流程探索与 AI 对话历史理解 AI 在编辑器里的职责边界。",
    keywords: ["AI 辅助", "节点预测", "流程探索", "AI 对话历史"],
    modules: [
      {
        id: "assist",
        title: "AI 辅助",
        summary: "先分清节点预测、流程探索和 AI 对话历史分别解决什么问题。",
        keywords: ["AI 辅助", "节点预测", "流程探索"],
        loader: () => import("./entries/ai/assist"),
      },
      {
        id: "prerequisites",
        title: "AI 前置条件",
        summary: "确认设备连接、截图来源和 AI 配置是否同时就绪。",
        keywords: ["AI 前置条件", "AI API", "视觉模型"],
        loader: () => import("./entries/ai/prerequisites"),
      },
      {
        id: "common-issues",
        title: "AI 常见问题",
        summary: "AI 失败时，先定位是上下文、配置还是模型能力的问题。",
        keywords: ["AI 常见问题", "AI 失败", "视觉模型"],
        loader: () => import("./entries/ai/commonIssues"),
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
