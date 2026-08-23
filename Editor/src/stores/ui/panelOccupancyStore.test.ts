import { beforeEach, describe, expect, it } from "vitest";
import { usePanelOccupancyStore } from "./panelOccupancyStore";

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

describe("panelOccupancyStore", () => {
  it("激活面板时只关闭同一占位区域的活动面板", () => {
    const store = usePanelOccupancyStore.getState();

    store.activate("connection");
    expect(usePanelOccupancyStore.getState().activePanels).toEqual({
      "right-sidebar": "connection",
      "right-embedded": null,
      left: null,
      bottom: null,
    });

    store.activate("localFile");
    expect(usePanelOccupancyStore.getState().activePanels).toEqual({
      "right-sidebar": "connection",
      "right-embedded": null,
      left: "localFile",
      bottom: null,
    });
  });

  it("被替换的侧栏不能释放当前侧栏", () => {
    const store = usePanelOccupancyStore.getState();

    store.activate("aiHistory");
    store.activate("connection");
    store.deactivate("aiHistory");

    expect(usePanelOccupancyStore.getState().activePanels["right-sidebar"]).toBe(
      "connection",
    );
  });

  it("右侧边栏与右侧内嵌面板可以同时占位", () => {
    const store = usePanelOccupancyStore.getState();

    store.activate("debug");
    store.activate("field");

    expect(usePanelOccupancyStore.getState().activePanels).toEqual({
      "right-sidebar": "debug",
      "right-embedded": "field",
      left: null,
      bottom: null,
    });
  });
});
