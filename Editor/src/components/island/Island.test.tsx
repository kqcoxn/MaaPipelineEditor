import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Island } from "./Island";

function mountHost() {
  const canvas = document.createElement("div");
  canvas.id = "mpe-main-canvas";
  const host = document.createElement("div");
  host.id = "mpe-island-host";
  canvas.appendChild(host);
  document.body.appendChild(canvas);
}

describe("Island", () => {
  beforeEach(() => {
    mountHost();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    document.getElementById("mpe-main-canvas")?.remove();
    vi.useRealTimers();
  });

  it("点击摘要触发 onOpen，动作槽可自定义", () => {
    const onOpen = vi.fn();
    const onAction = vi.fn();
    render(
      <Island
        indicator="*"
        summary={{ title: "标题", owner: "分类", subtitle: "说明" }}
        onOpen={onOpen}
        openLabel="打开详情"
        actions={[{
          key: "act",
          node: <button type="button" onClick={onAction}>自定义动作</button>,
        }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "打开详情" }));
    fireEvent.click(screen.getByRole("button", { name: "自定义动作" }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("停留后自动收起，悬停时暂停收起", () => {
    const onHidden = vi.fn();
    render(
      <Island
        indicator="*"
        summary={{ title: "可收起", subtitle: "副标题" }}
        onOpen={() => undefined}
        openLabel="打开"
        autoHide={{ enabled: true, durationMs: 4000 }}
        onHidden={onHidden}
      />,
    );

    const shell = screen.getByRole("button", { name: "打开" }).closest("[data-hovered]")!;
    fireEvent.mouseEnter(shell);
    act(() => vi.advanceTimersByTime(15000));
    expect(screen.getByText("可收起")).toBeInTheDocument();
    expect(onHidden).not.toHaveBeenCalled();

    fireEvent.mouseLeave(shell);
    act(() => vi.advanceTimersByTime(3999));
    expect(screen.getByText("可收起")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(481));
    expect(screen.queryByText("可收起")).toBeNull();
    expect(onHidden).toHaveBeenCalledOnce();
  });

  it("展开详情，并在展开时暂停自动收起", () => {
    render(
      <Island
        indicator="*"
        summary={{ title: "可展开", subtitle: "副标题" }}
        onOpen={() => undefined}
        openLabel="打开"
        expandable
        expandLabel="展开当前阶段详情"
        collapseLabel="收起当前阶段详情"
        details={<div>详情内容</div>}
        autoHide={{ enabled: true, durationMs: 1000, pauseWhenExpanded: true }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "展开当前阶段详情" }));
    expect(screen.getByText("详情内容")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("可展开")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "收起当前阶段详情" }));
    act(() => vi.advanceTimersByTime(1481));
    expect(screen.queryByText("可展开")).toBeNull();
  });

  it("identity 变化时重置离场状态", () => {
    const { rerender } = render(
      <Island
        islandKey="a"
        indicator="*"
        summary={{ title: "第一条", subtitle: "A" }}
        onOpen={() => undefined}
        openLabel="打开"
        autoHide={{ enabled: true, durationMs: 1000 }}
      />,
    );

    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("button", { name: "打开" }).closest("[data-exiting]")).toHaveAttribute(
      "data-exiting",
      "true",
    );

    rerender(
      <Island
        islandKey="b"
        indicator="*"
        summary={{ title: "第二条", subtitle: "B" }}
        onOpen={() => undefined}
        openLabel="打开"
        autoHide={{ enabled: true, durationMs: 1000 }}
      />,
    );

    expect(screen.getByText("第二条")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开" }).closest("[data-exiting]")).toHaveAttribute(
      "data-exiting",
      "false",
    );
  });
});
