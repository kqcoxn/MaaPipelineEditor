import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
      toast: null,
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
      useAchievementStore.getState().setToast({
        kind: "unlock",
        id: "canvas_first_node",
      });
    });

    expect(screen.getByText("达成成就：第一步")).toBeInTheDocument();
    expect(screen.getByText("创建第一个节点")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看成就" }));
    expect(useAchievementStore.getState().wallOpen).toBe(true);
    expect(useAchievementStore.getState().toast).toBeNull();
  });

  it("补发胶囊汇总多个成就标题", () => {
    render(<AchievementUnlockIsland />);
    act(() => {
      useAchievementStore.getState().setToast({
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
      useAchievementStore.getState().setToast({
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
});
