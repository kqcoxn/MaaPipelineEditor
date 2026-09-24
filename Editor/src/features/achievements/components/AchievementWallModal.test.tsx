import "@testing-library/jest-dom/vitest";
import { Profiler } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAchievementStore } from "@/stores/achievement/achievementStore";
import { AchievementWallModal } from "./AchievementWallModal";
import { AchievementCard } from "./AchievementCard";
import { buildAchievementItems, type AchievementItem } from "../presentation";
import { achievementDefs } from "../defs";

// 复用真实卡片，隔离 React Flow 对浏览器布局测量的依赖。
vi.mock("./AchievementGraph", () => ({
  AchievementGraph: ({ items }: { items: AchievementItem[] }) => (
    <div data-testid="achievement-graph">
      {items.map((item) => <AchievementCard key={item.key} item={item} graph />)}
    </div>
  ),
}));

beforeEach(() => {
  localStorage.clear();
  useAchievementStore.setState({ counters: { node_created: 27 }, unlocked: { canvas_first_node: { at: 1 }, canvas_nodes: { at: 1 } }, progress: {}, wallOpen: true });
});
afterEach(cleanup);

describe("成就面板交互", () => {
  it("无关计数更新不重绘卡片，自身进度仍实时刷新", () => {
    const item = buildAchievementItems(achievementDefs, useAchievementStore.getState().unlocked)
      .find((item) => item.key === "node_created")!;
    const rendered = vi.fn();
    render(<Profiler id="card" onRender={rendered}><AchievementCard item={item} /></Profiler>);
    rendered.mockClear();
    act(() => useAchievementStore.getState().applyEnginePatch({ counterDelta: { pipeline_saved: 1 } }));
    expect(rendered).not.toHaveBeenCalled();
    act(() => useAchievementStore.getState().applyEnginePatch({ counterDelta: { node_created: 1 } }));
    expect(screen.getByText("28 / 50")).toBeInTheDocument();
    expect(rendered).toHaveBeenCalled();
  });

  it("图和成就册直接展示条件、进度，只显示到下一档", () => {
    render(<AchievementWallModal />);
    for (const mode of ["成就图", "成就册"]) {
      fireEvent.click(screen.getByText(mode));
      const completed = within(screen.getByRole("article", { name: "第一步" }));
      expect(completed.getByRole("progressbar")).toHaveAttribute("value", "100");
      expect(completed.getByText("解锁于")).toBeInTheDocument();
      const card = within(screen.getByRole("article", { name: "积土成山 Ⅰ" }));
      expect(card.getByText("累计创建 10 个 Pipeline 节点")).toBeInTheDocument();
      expect(card.getByText("下一档 · 积土成山 Ⅱ")).toBeInTheDocument();
      expect(card.getByText("累计创建 50 个 Pipeline 节点")).toBeInTheDocument();
      expect(card.getByText("27 / 50")).toBeInTheDocument();
      expect(screen.queryByText("积土成山 Ⅲ")).not.toBeInTheDocument();
      fireEvent.click(card.getByText("积土成山 Ⅰ"));
      expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    }
  });

  it("跨模式保持分类", () => {
    render(<AchievementWallModal />);
    fireEvent.click(screen.getByRole("button", { name: /^验证/ }));
    fireEvent.click(screen.getByText("成就册"));
    expect(screen.getByRole("button", { name: /^验证/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("拿来主义")).not.toBeInTheDocument();
  });

  it("重新打开面板时恢复成就册偏好，并保留隐藏成就占位", () => {
    render(<AchievementWallModal />);
    fireEvent.click(screen.getByText("成就册"));
    act(() => useAchievementStore.getState().setWallOpen(false));
    act(() => useAchievementStore.getState().setWallOpen(true));
    expect(screen.queryByTestId("achievement-graph")).not.toBeInTheDocument();
    expect(screen.getAllByText("未知的惊喜")[0]).toBeInTheDocument();
    expect(screen.queryByText("原来是这里")).not.toBeInTheDocument();
  });
});
