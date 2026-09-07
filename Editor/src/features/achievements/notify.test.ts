import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAchievementStore } from "@/stores/achievement/achievementStore";
import {
  notifyRetroactiveUnlocks,
  startUnlockNotifier,
} from "./notify";

describe("成就胶囊队列", () => {
  beforeEach(() => {
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
    vi.useRealTimers();
    useAchievementStore.getState().setToast(null);
  });

  it("延迟后把新解锁送入胶囊队列", () => {
    const dispose = startUnlockNotifier();
    useAchievementStore.getState().applyEnginePatch({ unlock: ["canvas_first_node"] });
    expect(useAchievementStore.getState().toast).toBeNull();

    act(() => vi.advanceTimersByTime(600));
    expect(useAchievementStore.getState().toast).toEqual({
      kind: "unlock",
      id: "canvas_first_node",
    });
    dispose();
  });

  it("补发走汇总胶囊而不是逐个解锁", () => {
    notifyRetroactiveUnlocks(["canvas_first_node", "canvas_first_edge"]);
    expect(useAchievementStore.getState().toast).toEqual({
      kind: "retroactive",
      ids: ["canvas_first_node", "canvas_first_edge"],
    });
  });
});
