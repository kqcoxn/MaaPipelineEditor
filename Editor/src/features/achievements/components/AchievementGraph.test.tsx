import "@testing-library/jest-dom/vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AchievementGraph } from "./AchievementGraph";
import { achievementDefs } from "../defs";
import { buildAchievementItems } from "../presentation";

// happy-dom 不提供布局，模拟浏览器尺寸回报；保留真实 React Flow 和 ELK。
class LayoutObserver {
  private active = new Set<Element>();
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element) {
    this.active.add(target);
    queueMicrotask(() => {
      if (this.active.has(target)) this.callback([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver);
    });
  }
  unobserve(target: Element) { this.active.delete(target); }
  disconnect() { this.active.clear(); }
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("成就图真实渲染与布局链路", () => {
  it("尺寸回报后离开初始横排，并生成三个分区", async () => {
    vi.stubGlobal("ResizeObserver", LayoutObserver);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("react-flow__node") ? 280 : 1100;
    });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("react-flow__node") ? 180 : 600;
    });
    const { container } = render(<AchievementGraph items={buildAchievementItems(achievementDefs, {})} />);
    await waitFor(() => {
      expect(container.querySelectorAll(".react-flow__node-region")).toHaveLength(3);
    }, { timeout: 4000 });
    const nodes = [...container.querySelectorAll<HTMLElement>(".react-flow__node-achievement")];
    expect(nodes).toHaveLength(9);
    const rows = new Set(nodes.map((node) => node.style.transform.match(/translate\([^,]+,\s*([^)]+)\)/)?.[1]));
    expect(rows.size).toBeGreaterThan(1);
  });
});
