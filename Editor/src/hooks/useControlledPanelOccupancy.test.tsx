import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePanelOccupancyStore } from "@/stores/ui/panelOccupancyStore";
import { useControlledPanelOccupancy } from "./useControlledPanelOccupancy";

beforeEach(() => {
  usePanelOccupancyStore.setState({
    activePanels: {
      "right-sidebar": null,
      "right-embedded": null,
      left: null,
      bottom: null,
    },
  });
});

describe("useControlledPanelOccupancy", () => {
  it("打开新侧栏时不会被抢占前的旧状态立即关闭", () => {
    usePanelOccupancyStore.getState().activate("connection");
    const onDisplaced = vi.fn();

    const { result } = renderHook(() =>
      useControlledPanelOccupancy("aiHistory", true, onDisplaced),
    );

    expect(result.current).toBe(true);
    expect(usePanelOccupancyStore.getState().activePanels["right-sidebar"]).toBe(
      "aiHistory",
    );
    expect(onDisplaced).not.toHaveBeenCalled();
  });

  it("其他侧栏激活后通知当前侧栏关闭自身状态", () => {
    const onDisplaced = vi.fn();

    const { result } = renderHook(() =>
      useControlledPanelOccupancy("aiHistory", true, onDisplaced),
    );
    expect(result.current).toBe(true);

    act(() => usePanelOccupancyStore.getState().activate("connection"));

    expect(result.current).toBe(false);
    expect(onDisplaced).toHaveBeenCalledOnce();
  });

  it("右侧内嵌面板激活时不影响右侧边栏", () => {
    const onDisplaced = vi.fn();

    const { result } = renderHook(() =>
      useControlledPanelOccupancy("aiHistory", true, onDisplaced),
    );

    act(() => usePanelOccupancyStore.getState().activate("field"));

    expect(result.current).toBe(true);
    expect(onDisplaced).not.toHaveBeenCalled();
    expect(usePanelOccupancyStore.getState().activePanels).toEqual({
      "right-sidebar": "aiHistory",
      "right-embedded": "field",
      left: null,
      bottom: null,
    });
  });
});
