import { useEffect, useRef } from "react";
import { usePanelOccupancy } from "./usePanelOccupancy";

/** 将组件自身的开关状态接入全局侧栏互斥系统。 */
export function useControlledPanelOccupancy(
  panelId: string,
  open: boolean,
  onDisplaced: () => void,
): boolean {
  const { isActive, isDisplaced, activate, deactivate } =
    usePanelOccupancy(panelId);
  const activationPendingRef = useRef(false);

  useEffect(() => {
    if (!open) {
      activationPendingRef.current = false;
      deactivate();
      return;
    }

    activationPendingRef.current = true;
    activate();
    return deactivate;
  }, [open, activate, deactivate]);

  useEffect(() => {
    if (!open) {
      activationPendingRef.current = false;
      return;
    }
    if (isActive) {
      activationPendingRef.current = false;
      return;
    }
    if (activationPendingRef.current) {
      activationPendingRef.current = false;
      return;
    }
    if (isDisplaced) onDisplaced();
  }, [open, isActive, isDisplaced, onDisplaced]);

  return open && isActive;
}
