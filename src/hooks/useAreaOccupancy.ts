import { useMemo } from "react";
import {
  usePanelOccupancyStore,
  type PanelArea,
} from "../stores/panelOccupancyStore";

/**
 * 区域占位观察 Hook
 *
 * 用于布局组件或非面板组件观察某个区域的占位状态
 */
export function useAreaOccupancy(area: PanelArea): {
  /**当前激活的面板 ID */
  activePanelId: string | null;
  /**区域是否被占用 */
  isOccupied: boolean;
} {
  const activePanelId = usePanelOccupancyStore(
    (state) => state.activePanels[area],
  );

  return useMemo(
    () => ({
      activePanelId,
      isOccupied: activePanelId !== null,
    }),
    [activePanelId],
  );
}
