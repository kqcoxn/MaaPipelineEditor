import type { WikiEntryMeta, WikiTarget } from "./types";

export const wikiEntries: WikiEntryMeta[] = [
  {
    id: "debug",
    title: "调试",
    summary: "了解 FlowScope 调试工作台、节点线和事件线的基础使用方式。",
    keywords: ["debug", "FlowScope", "调试", "节点线", "事件线"],
    modules: [
      {
        id: "showcase",
        title: "功能展示",
        summary: "快速认识调试工作台里最常用的区域。",
        keywords: ["功能展示", "调试面板", "总览"],
        loader: () => import("./entries/debug/showcase"),
      },
      {
        id: "tutorial",
        title: "调试方法",
        summary: "按步骤了解从节点开始调试到查看结果的基本路径。",
        keywords: ["教程", "入口节点", "运行", "结果"],
        loader: () => import("./entries/debug/tutorial"),
      },
    ],
  },
  {
    id: "toolbox",
    title: "工具箱",
    summary: "查看截图、ROI、OCR、模板等辅助工具的使用入口。",
    keywords: ["工具箱", "ROI", "截图", "OCR", "模板"],
    modules: [
      {
        id: "roi",
        title: "ROI 工具",
        summary: "理解 ROI 选择、偏移和负坐标等常用操作。",
        keywords: ["ROI", "范围", "坐标", "偏移"],
        loader: () => import("./entries/toolbox/roi"),
      },
      {
        id: "screenshot",
        title: "截图工具",
        summary: "了解截图相关工具在字段编辑和工具箱中的使用方式。",
        keywords: ["截图", "图片", "模板", "OCR"],
        loader: () => import("./entries/toolbox/screenshot"),
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
