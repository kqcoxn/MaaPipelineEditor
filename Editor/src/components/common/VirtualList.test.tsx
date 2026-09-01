import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { VirtualList } from "./VirtualList";

describe("VirtualList", () => {
  afterEach(cleanup);

  it("只挂载视口附近的固定高度行", () => {
    const items = Array.from({ length: 300 }, (_, index) => ({
      id: `row-${index}`,
      label: `Row ${index}`,
    }));
    render(
      <VirtualList
        ariaLabel="测试虚拟列表"
        estimatedItemHeight={24}
        height={120}
        itemKey={(item) => item.id}
        items={items}
        renderItem={(item) => <div style={{ height: 24 }}>{item.label}</div>}
      />,
    );

    const list = screen.getByRole("list", { name: "测试虚拟列表" });
    expect(list).toHaveAttribute("tabindex", "0");
    const mountedRows = list.querySelectorAll("[data-virtual-row-key]");
    expect(mountedRows.length).toBeGreaterThan(0);
    expect(mountedRows.length).toBeLessThan(10);
    expect(screen.queryByText("Row 299")).not.toBeInTheDocument();
  });

  it("滚动后替换已挂载的行", () => {
    const items = Array.from({ length: 100 }, (_, index) => ({ id: index }));
    render(
      <VirtualList
        ariaLabel="可滚动虚拟列表"
        estimatedItemHeight={20}
        height={100}
        itemKey={(item) => item.id}
        items={items}
        renderItem={(item) => <div style={{ height: 20 }}>Item {item.id}</div>}
      />,
    );

    const holder = screen
      .getByRole("list", { name: "可滚动虚拟列表" })
      .querySelector<HTMLElement>(".rc-virtual-list-holder");
    expect(holder).not.toBeNull();
    fireEvent.scroll(holder!, { target: { scrollTop: 1000 } });

    expect(screen.getByText("Item 50")).toBeInTheDocument();
    expect(screen.queryByText("Item 0")).not.toBeInTheDocument();
  });

  it("记录 PERF-011 验收规模的挂载行数", () => {
    const scenarios = [
      { name: "nodes", total: 301, height: 431, itemHeight: 40 },
      { name: "logs", total: 1000, height: 308, itemHeight: 48 },
      { name: "errors", total: 300, height: 234, itemHeight: 26 },
    ];
    const mountedCounts = scenarios.map((scenario) => {
      const { unmount } = render(
        <VirtualList
          ariaLabel={scenario.name}
          estimatedItemHeight={scenario.itemHeight}
          height={scenario.height}
          itemKey={(item) => item}
          items={Array.from({ length: scenario.total }, (_, index) => index)}
          renderItem={(item) => (
            <div style={{ height: scenario.itemHeight }}>{item}</div>
          )}
        />,
      );
      const mounted = screen
        .getByRole("list", { name: scenario.name })
        .querySelectorAll("[data-virtual-row-key]").length;
      expect(mounted).toBeLessThan(scenario.total);
      unmount();
      return `${scenario.name}=${mounted}/${scenario.total}`;
    });

    console.info(`[PERF-011] mounted rows: ${mountedCounts.join(", ")}`);
  });
});
