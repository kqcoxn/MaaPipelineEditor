import { useCallback, useMemo } from "react";
import {
  usePanelOccupancyStore,
  getPanelDescriptor,
  type PanelReaction,
} from "../stores/panelOccupancyStore";

/**
 * 面板占位互斥 Hook
 *
 * 面板组件通过此 Hook 与占位系统交互：
 * - isActive: 是否是当前区域激活者
 * - isDisplaced: 是否被其他面板排挤（被动面板：区域有任何激活者即为 true）
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

  const { area, reaction, passive } = descriptor;

  // 选择当前区域的激活面板 ID
  const activePanelId = usePanelOccupancyStore(
    (state) => state.activePanels[area],
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
