import type { StateCreator } from "zustand";
import type { ReactFlowInstance, Viewport } from "@xyflow/react";
import type { FlowStore, FlowViewState } from "../types";
import { cancelPendingFitView, validViewport } from "../utils/viewportUtils";

export const createViewSlice: StateCreator<FlowStore, [], [], FlowViewState> = (
  set,
) => ({
  // 初始状态
  instance: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  pendingViewport: null,
  requestViewport(viewport) {
    cancelPendingFitView();
    set({ pendingViewport: validViewport(viewport) ?? null });
  },
  size: { width: 0, height: 0 },

  // 更新 ReactFlow 实例
  updateInstance(instance: ReactFlowInstance) {
    set({ instance });
  },

  // 更新视口状态
  updateViewport(viewport: Viewport) {
    set({ viewport });
  },

  // 更新画布尺寸
  updateSize(width: number, height: number) {
    set((state) =>
      state.size.width === width && state.size.height === height
        ? state
        : { size: { width, height } },
    );
  },
});
