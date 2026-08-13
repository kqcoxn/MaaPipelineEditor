import {
  useCallback,
  useLayoutEffect,
  useState,
  type RefObject,
} from "react";

const getPanelBottomPadding = (element: HTMLElement) => {
  const panel = element.closest<HTMLElement>(".panel-base");
  if (!panel) return 0;

  return Number.parseFloat(window.getComputedStyle(panel).paddingBottom) || 0;
};

const getViewportBottom = (bottomGap: number) => {
  const layoutPanel = document.querySelector<HTMLElement>(
    '[data-panel-role="layout"]',
  );
  const layoutTop = layoutPanel?.getBoundingClientRect().top;
  const viewportBottom = window.innerHeight - bottomGap;

  if (layoutTop === undefined || layoutTop <= 0) {
    return viewportBottom;
  }

  return Math.min(viewportBottom, layoutTop - bottomGap);
};

/** 根据元素的实际视口位置，计算不越过窗口底部的最大可用高度。 */
export function useViewportBoundedHeight(
  elementRef: RefObject<HTMLElement | null>,
  refreshKey: string,
  bottomGap = 20,
) {
  const [maxHeight, setMaxHeight] = useState<number>();

  const updateMaxHeight = useCallback(() => {
    const element = elementRef.current;
    if (!element) return;

    const elementTop = element.getBoundingClientRect().top;
    const panelBottomPadding = getPanelBottomPadding(element);
    const availableHeight = Math.max(
      0,
      Math.floor(
        getViewportBottom(bottomGap) - elementTop - panelBottomPadding,
      ),
    );

    setMaxHeight((current) =>
      current === availableHeight ? current : availableHeight,
    );
  }, [bottomGap, elementRef]);

  useLayoutEffect(() => {
    updateMaxHeight();
    const animationFrame = window.requestAnimationFrame(updateMaxHeight);
    const panel = elementRef.current?.closest<HTMLElement>(".panel-base");
    const layoutPanel = document.querySelector<HTMLElement>(
      '[data-panel-role="layout"]',
    );
    const resizeObserver = panel
      ? new ResizeObserver(updateMaxHeight)
      : undefined;

    if (panel) resizeObserver?.observe(panel);
    if (layoutPanel) resizeObserver?.observe(layoutPanel);
    window.addEventListener("resize", updateMaxHeight);
    window.addEventListener("mouseup", updateMaxHeight);
    window.visualViewport?.addEventListener("resize", updateMaxHeight);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateMaxHeight);
      window.removeEventListener("mouseup", updateMaxHeight);
      window.visualViewport?.removeEventListener("resize", updateMaxHeight);
    };
  }, [elementRef, refreshKey, updateMaxHeight]);

  return maxHeight;
}
