import type { ReactFlowInstance, Viewport } from "@xyflow/react";
import type { NodeType, PositionType } from "../types";

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
