import { beforeEach, describe, expect, it } from "vitest";
import { usePanelOccupancyStore } from "./panelOccupancyStore";

beforeEach(() => {
  usePanelOccupancyStore.setState({
    activePanels: { right: null, left: null, bottom: null },
  });
});

describe("panelOccupancyStore", () => {
  it("激活任一侧栏时关闭其他区域的活动侧栏", () => {
    const store = usePanelOccupancyStore.getState();

    store.activate("json");
    expect(usePanelOccupancyStore.getState().activePanels).toEqual({
      right: "json",
      left: null,
      bottom: null,
    });

    store.activate("localFile");
    expect(usePanelOccupancyStore.getState().activePanels).toEqual({
      right: null,
      left: "localFile",
      bottom: null,
    });
  });

  it("被替换的侧栏不能释放当前侧栏", () => {
    const store = usePanelOccupancyStore.getState();

    store.activate("aiHistory");
    store.activate("debug");
    store.deactivate("aiHistory");

    expect(usePanelOccupancyStore.getState().activePanels.right).toBe("debug");
  });
});
