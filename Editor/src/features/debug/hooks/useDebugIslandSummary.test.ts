import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebugIslandSummary } from "./useDebugIslandSummary";

const summary = (key: string, subtitle = key) => ({ key, title: key, owner: "节点", subtitle });

describe("胶囊阶段文字合并", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("快速变化只显示窗口结束时的最新状态，不因连续事件无限延迟", () => {
    const { result, rerender } = renderHook(({ value }) => useDebugIslandSummary(value, false),
      { initialProps: { value: summary("识别") } });
    rerender({ value: summary("动作") });
    act(() => vi.advanceTimersByTime(100));
    rerender({ value: summary("等待") });
    act(() => vi.advanceTimersByTime(100));
    rerender({ value: summary("下一节点") });
    expect(result.current.title).toBe("识别");
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.title).toBe("下一节点");
  });

  it("同一操作的计时直接更新，停止或结束立即显示并取消旧状态", () => {
    const { result, rerender } = renderHook(({ value, immediate }) => useDebugIslandSummary(value, immediate),
      { initialProps: { value: summary("识别", "0.0s"), immediate: false } });
    rerender({ value: summary("识别", "0.3s"), immediate: false });
    expect(result.current.subtitle).toBe("0.3s");
    rerender({ value: summary("动作"), immediate: false });
    rerender({ value: summary("已停止"), immediate: true });
    expect(result.current.title).toBe("已停止");
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.title).toBe("已停止");
  });

  it("短暂偏离后返回原状态时不闪现中间阶段", () => {
    const { result, rerender } = renderHook(({ value }) => useDebugIslandSummary(value, false),
      { initialProps: { value: summary("识别") } });
    rerender({ value: summary("等待") });
    act(() => vi.advanceTimersByTime(100));
    rerender({ value: summary("识别") });
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.title).toBe("识别");
  });
});
