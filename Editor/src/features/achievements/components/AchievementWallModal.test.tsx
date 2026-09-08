import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAchievementStore } from "@/stores/achievement/achievementStore";
import { AchievementWallModal } from "./AchievementWallModal";
import { AchievementCard } from "./AchievementCard";
import type { AchievementItem } from "../presentation";

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
  useAchievementStore.setState({ counters: { node_created: 27 }, unlocked: { canvas_first_node: { at: 1 }, canvas_nodes_10: { at: 1 } }, progress: {}, wallOpen: true });
});
afterEach(cleanup);

describe("成就面板交互", () => {
  it("图和成就册直接展示条件、进度，只显示到下一档", () => {
    render(<AchievementWallModal />);
    for (const mode of ["成就图", "成就册"]) {
      fireEvent.click(screen.getByText(mode));
      const completed = within(screen.getByRole("article", { name: "第一步" }));
      expect(completed.getByRole("progressbar")).toHaveAttribute("value", "100");
      expect(completed.getByText("解锁于")).toBeInTheDocument();
      const card = within(screen.getByRole("article", { name: "初窥门径" }));
      expect(card.getByText("累计创建 10 个节点")).toBeInTheDocument();
      expect(card.getByText("下一档 · 渐入佳境")).toBeInTheDocument();
      expect(card.getByText("累计创建 50 个节点")).toBeInTheDocument();
      expect(card.getByText("27 / 50")).toBeInTheDocument();
      expect(screen.queryByText("管线大师")).not.toBeInTheDocument();
      fireEvent.click(card.getByText("初窥门径"));
      expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    }
  });

  it("跨模式保持分类", () => {
    render(<AchievementWallModal />);
    fireEvent.click(screen.getByRole("button", { name: /^调试/ }));
    fireEvent.click(screen.getByText("成就册"));
    expect(screen.getByRole("button", { name: /^调试/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("拿来主义")).not.toBeInTheDocument();
  });

  it("重新打开面板时恢复成就册偏好，并保留隐藏成就占位", () => {
    render(<AchievementWallModal />);
    fireEvent.click(screen.getByText("成就册"));
    act(() => useAchievementStore.getState().setWallOpen(false));
    act(() => useAchievementStore.getState().setWallOpen(true));
    expect(screen.queryByTestId("achievement-graph")).not.toBeInTheDocument();
    expect(screen.getByText("未知的惊喜")).toBeInTheDocument();
    expect(screen.queryByText("夜猫子")).not.toBeInTheDocument();
  });
});
