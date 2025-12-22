import type { ReactFlowInstance, Viewport } from "@xyflow/react";
import type { NodeType, PositionType } from "../types";

/**
 * 规范化视口数据，将坐标取整，缩放值保留两位小数
 * @param viewport 原始视口数据
 * @returns 规范化后的视口数据，如果输入为 undefined 则返回 undefined
 */
export function normalizeViewport(
  viewport: { x: number; y: number; zoom: number } | undefined
): { x: number; y: number; zoom: number } | undefined {
  if (!viewport) return undefined;
  return {
    x: Math.round(viewport.x),
    y: Math.round(viewport.y),
    zoom: Math.round(viewport.zoom * 100) / 100,
  };
}

// 聚焦视图
export function fitFlowView(
  instance: ReactFlowInstance | null,
  viewport: Viewport,
  options?: {
    focusNodes?: NodeType[];
    interpolate?: "linear" | "smooth" | undefined;
    duration?: number;
    minZoom?: number;
    maxZoom?: number;
  }
) {
  setTimeout(() => {
    const fitView = instance?.fitView;
    if (!fitView) return;

    const {
      focusNodes,
      interpolate = "linear",
      duration = 500,
      minZoom = viewport.zoom,
      maxZoom = viewport.zoom,
    } = options || {};

    fitView({
      nodes: focusNodes,
      interpolate,
      duration,
      minZoom,
      maxZoom,
    });
  }, 100);
}
