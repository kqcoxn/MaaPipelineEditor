import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAchievementStore } from "@/stores/achievement/achievementStore";
import { AchievementUnlockIsland } from "./AchievementUnlockIsland";

vi.mock("../celebrate", () => ({
  celebrateAchievementUnlock: vi.fn(),
}));

describe("成就解锁胶囊", () => {
  beforeEach(() => {
    const canvas = document.createElement("div");
    canvas.id = "mpe-main-canvas";
    const host = document.createElement("div");
    host.id = "mpe-island-host";
    canvas.appendChild(host);
    document.body.appendChild(canvas);
    vi.useFakeTimers();
    useAchievementStore.setState({
      counters: {},
      unlocked: {},
      progress: {},
      wallOpen: false,
      toasts: [],
    });
  });

  afterEach(() => {
    cleanup();
    document.getElementById("mpe-main-canvas")?.remove();
    vi.useRealTimers();
  });

  it("展示解锁胶囊，点击打开成就墙并关闭胶囊", () => {
    render(<AchievementUnlockIsland />);
    act(() => {
      useAchievementStore.getState().addToast({
        kind: "unlock",
        id: "canvas_first_node",
      });
    });

    expect(screen.getByText("达成成就：第一步")).toBeInTheDocument();
    expect(screen.getByText("创建第一个节点")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看成就" }));
    expect(useAchievementStore.getState().wallOpen).toBe(true);
    expect(useAchievementStore.getState().toasts).toEqual([]);
  });

  it("补发胶囊汇总多个成就标题", () => {
    render(<AchievementUnlockIsland />);
    act(() => {
      useAchievementStore.getState().addToast({
        kind: "retroactive",
        ids: ["canvas_first_node", "canvas_first_edge"],
      });
    });

    expect(screen.getByText("达成成就：补发 2 个")).toBeInTheDocument();
    expect(screen.getByText("第一步、牵针引线")).toBeInTheDocument();
  });

  it("停留后自动收起，悬停时暂停收起", () => {
    render(<AchievementUnlockIsland />);
    act(() => {
      useAchievementStore.getState().addToast({
        kind: "unlock",
        id: "canvas_first_node",
      });
    });

    const island = screen
      .getByRole("button", { name: "打开成就墙" })
      .closest("[data-tone]")!;
    fireEvent.mouseEnter(island);
    act(() => vi.advanceTimersByTime(15000));
    expect(screen.getByText("达成成就：第一步")).toBeInTheDocument();

    fireEvent.mouseLeave(island);
    act(() => vi.advanceTimersByTime(3999));
    expect(screen.getByText("达成成就：第一步")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(481));
    expect(screen.queryByText("达成成就：第一步")).toBeNull();
  });

  it("连续通知独立计时，新通知不重置旧通知的退场", () => {
    render(<AchievementUnlockIsland />);
    act(() => useAchievementStore.getState().addToast({ kind: "unlock", id: "canvas_first_node" }));
    act(() => vi.advanceTimersByTime(1000));
    act(() => useAchievementStore.getState().addToast({ kind: "unlock", id: "canvas_first_edge" }));
    expect(screen.getAllByRole("button", { name: "打开成就墙" })).toHaveLength(2);
    act(() => vi.advanceTimersByTime(3480));
    expect(screen.queryByText("达成成就：第一步")).toBeNull();
    expect(screen.getByText("达成成就：牵针引线")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(useAchievementStore.getState().toasts).toEqual([]);
  });

  it.each(["hover", "focus"])("%s 只暂停当前胶囊", (interaction) => {
    render(<AchievementUnlockIsland />);
    act(() => {
      useAchievementStore.getState().addToast({ kind: "unlock", id: "canvas_first_node" });
      useAchievementStore.getState().addToast({ kind: "unlock", id: "canvas_first_edge" });
    });
    const button = screen.getAllByRole("button", { name: "打开成就墙" })[0];
    const island = button.closest("[data-tone]")!;
    if (interaction === "hover") fireEvent.mouseEnter(island);
    else fireEvent.focus(button);
    act(() => vi.advanceTimersByTime(4480));
    expect(screen.getByText("达成成就：第一步")).toBeInTheDocument();
    expect(screen.queryByText("达成成就：牵针引线")).toBeNull();
    if (interaction === "hover") fireEvent.mouseLeave(island);
    else fireEvent.blur(button);
    act(() => vi.advanceTimersByTime(4480));
    expect(useAchievementStore.getState().toasts).toEqual([]);
  });

  it("点击查看只关闭当前胶囊，不影响其他通知", () => {
    render(<AchievementUnlockIsland />);
    act(() => {
      useAchievementStore.getState().addToast({ kind: "unlock", id: "canvas_first_node" });
      useAchievementStore.getState().addToast({ kind: "retroactive", ids: ["canvas_first_edge"] });
    });
    const island = screen.getByText("达成成就：第一步").closest<HTMLElement>("[data-tone]")!;
    fireEvent.click(within(island).getByRole("button", { name: "查看成就" }));
    expect(useAchievementStore.getState().wallOpen).toBe(true);
    expect(screen.queryByText("达成成就：第一步")).toBeNull();
    expect(screen.getByText("达成成就：补发 1 个")).toBeInTheDocument();
  });

});
