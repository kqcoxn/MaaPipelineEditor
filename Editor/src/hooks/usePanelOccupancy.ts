import { useCallback, useMemo } from "react";
import {
  usePanelOccupancyStore,
  getPanelDescriptor,
  type PanelReaction,
} from "@/stores/ui/panelOccupancyStore";

/**
 * 面板占位互斥 Hook
 *
 * 面板组件通过此 Hook 与占位系统交互：
 * - isActive: 是否是当前全局激活者
 * - isDisplaced: 是否被其他侧栏排挤
 * - activate / deactivate: 抢占 / 释放区域
 */
export function usePanelOccupancy(panelId: string): {
  /**是否是当前区域激活者 */
  isActive: boolean;
  /**是否被其他面板排挤 */
  isDisplaced: boolean;
  /**抢占区域 */
  activate: () => void;
  /**释放区域 */
  deactivate: () => void;
  /**面板配置的反应形态 */
  reaction: PanelReaction;
} {
  const descriptor = getPanelDescriptor(panelId);

  if (!descriptor) {
    throw new Error(`[usePanelOccupancy] 未注册的面板: ${panelId}`);
  }

  const { reaction, passive } = descriptor;

  // 主动侧栏全局互斥，被动面板会对任一区域的占用作出反应。
  const activePanelId = usePanelOccupancyStore(
    (state) =>
      state.activePanels.right ??
      state.activePanels.left ??
      state.activePanels.bottom,
  );
  const storeActivate = usePanelOccupancyStore((state) => state.activate);
  const storeDeactivate = usePanelOccupancyStore((state) => state.deactivate);

  const isActive = !passive && activePanelId === panelId;
  const isDisplaced = passive
    ? activePanelId !== null
    : activePanelId !== null && activePanelId !== panelId;

  const activate = useCallback(() => {
    storeActivate(panelId);
  }, [storeActivate, panelId]);

  const deactivate = useCallback(() => {
    storeDeactivate(panelId);
  }, [storeDeactivate, panelId]);

  return useMemo(
    () => ({ isActive, isDisplaced, activate, deactivate, reaction }),
    [isActive, isDisplaced, activate, deactivate, reaction],
  );
}
