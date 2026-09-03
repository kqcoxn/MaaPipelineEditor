import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getProcessTiming,
  runWithProcess,
  shouldShowBulkProcess,
  yieldToBrowserPaint,
  useProcessStore,
} from "./processStore";

describe("processStore", () => {
  const animationFrames: FrameRequestCallback[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    animationFrames.length = 0;
    useProcessStore.setState({ entries: [] });
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps the process visible for two frames before running the task", async () => {
    const task = vi.fn(() => "done");

    const result = runWithProcess("正在重排节点", task);

    expect(useProcessStore.getState().entries).toEqual([
      expect.objectContaining({ label: "正在重排节点" }),
    ]);
    expect(task).not.toHaveBeenCalled();

    animationFrames.shift()?.(0);
    expect(task).not.toHaveBeenCalled();
    animationFrames.shift()?.(16);

    await Promise.resolve();
    expect(task).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(0);
    expect(task).toHaveBeenCalledOnce();
    expect(useProcessStore.getState().entries).toEqual([
      expect.objectContaining({ label: "正在重排节点" }),
    ]);

    animationFrames.shift()?.(32);
    animationFrames.shift()?.(48);
    await vi.advanceTimersByTimeAsync(0);

    await expect(result).resolves.toBe("done");
    expect(useProcessStore.getState().entries).toEqual([]);
  });

  it("only applies production timing and uses a strict bulk threshold", () => {
    expect(getProcessTiming(true)).toEqual({
      minimumVisibleMs: 0,
      completeHoldMs: 0,
    });
    expect(getProcessTiming(false)).toEqual({
      minimumVisibleMs: 1_500,
      completeHoldMs: 240,
    });
    expect(shouldShowBulkProcess(100)).toBe(false);
    expect(shouldShowBulkProcess(101)).toBe(true);
  });

  it("yields until an animation frame has actually been painted", async () => {
    let resumed = false;
    const result = yieldToBrowserPaint().then(() => {
      resumed = true;
    });

    await Promise.resolve();
    expect(resumed).toBe(false);

    animationFrames.shift()?.(0);
    await Promise.resolve();
    expect(resumed).toBe(false);

    await vi.advanceTimersByTimeAsync(0);
    await result;
    expect(resumed).toBe(true);
  });

  it("finishes concurrent processes independently", () => {
    const firstProcess = useProcessStore.getState().begin("第一项");
    const secondProcess = useProcessStore.getState().begin("第二项");

    firstProcess.finish();
    expect(useProcessStore.getState().entries.map((entry) => entry.label)).toEqual([
      "第二项",
    ]);

    secondProcess.finish();
    expect(useProcessStore.getState().entries).toEqual([]);
  });
});
