import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type {
  DebugEventKind,
  DebugNodeExecutionStatus,
} from "../types";
import type { DebugResourceHealthCategory } from "../types";
import { debugNodeExecutionEventKindLabels } from "../nodeExecutionDisplay";

export function useDebugComponentT() {
  const { t } = useTranslation();
  return {
    t,
    statusLabel: useCallback(
      (status: DebugNodeExecutionStatus) => statusLabel(t, status),
      [t],
    ),
    eventKindLabel: useCallback(
      (kind: DebugEventKind) => eventKindLabel(t, kind),
      [t],
    ),
    resourceHealthCategoryLabel: useCallback(
      (category: DebugResourceHealthCategory) =>
        resourceHealthCategoryLabel(t, category),
      [t],
    ),
    debugStatusLabel: useCallback(
      (status: string) => debugStatusLabel(t, status),
      [t],
    ),
  };
}

export function statusLabel(
  t: TFunction,
  status: DebugNodeExecutionStatus,
): string {
  const labels: Record<DebugNodeExecutionStatus, string> = {
    running: t("debug.nodeExecution.status.running", "运行中"),
    succeeded: t("debug.nodeExecution.status.succeeded", "成功"),
    failed: t("debug.nodeExecution.status.failed", "失败"),
    visited: t("debug.nodeExecution.status.visited", "已访问"),
  };
  return labels[status];
}

export function eventKindLabel(t: TFunction, kind: DebugEventKind): string {
  const defaults = debugNodeExecutionEventKindLabels;
  return t(`debug.nodeExecution.eventKind.${kind}`, defaults[kind]);
}

export function resourceHealthCategoryLabel(
  t: TFunction,
  category: DebugResourceHealthCategory,
): string {
  const labels: Record<DebugResourceHealthCategory, string> = {
    resolution: t("debug.resourceHealth.category.resolution", "资源路径解析"),
    loading: t("debug.resourceHealth.category.loading", "资源加载"),
    graph: t("debug.resourceHealth.category.graph", "流程图校验"),
  };
  return labels[category];
}

export function debugStatusLabel(t: TFunction, status: string): string {
  switch (status) {
    case "idle":
      return t("debug.common.status.idle", "未读取");
    case "loading":
      return t("debug.common.status.loading", "读取中");
    case "ready":
      return t("debug.common.status.ready", "已就绪");
    case "error":
      return t("debug.common.status.error", "读取失败");
    case "checking":
      return t("debug.common.status.checking", "检测中");
    default:
      return status;
  }
}
