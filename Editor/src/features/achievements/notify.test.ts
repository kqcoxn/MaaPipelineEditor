import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useAchievementStore } from "@/stores/achievement/achievementStore";
import { notifyRetroactiveUnlocks, startUnlockNotifier } from "./notify";

describe("成就胶囊通知", () => {
  let dispose: (() => void) | undefined;

  beforeEach(() => {
    useAchievementStore.getState().resetAll();
    dispose = startUnlockNotifier();
  });

  afterEach(() => dispose?.());

  it("同时及连续解锁立即追加，重复解锁不重复通知", () => {
    const store = useAchievementStore.getState();
    store.applyEnginePatch({ unlock: ["canvas_first_node", "canvas_first_edge"] });
    expect(useAchievementStore.getState().toasts).toHaveLength(2);
    store.applyEnginePatch({ unlock: ["canvas_first_node", "another"] });
    expect(useAchievementStore.getState().toasts.map((toast) =>
      toast.kind === "unlock" ? toast.id : null,
    )).toEqual(["canvas_first_node", "canvas_first_edge", "another"]);
  });

  it("补发汇总与新解锁共存", () => {
    notifyRetroactiveUnlocks(["canvas_first_node", "canvas_first_edge"]);
    useAchievementStore.getState().applyEnginePatch({ unlock: ["another"] });
    expect(useAchievementStore.getState().toasts).toMatchObject([
      { kind: "retroactive", ids: ["canvas_first_node", "canvas_first_edge"] },
      { kind: "unlock", id: "another" },
    ]);
  });

  it("停止通知器清空胶囊并取消订阅", () => {
    useAchievementStore.getState().applyEnginePatch({ unlock: ["first"] });
    dispose?.();
    useAchievementStore.getState().applyEnginePatch({ unlock: ["second"] });
    expect(useAchievementStore.getState().toasts).toEqual([]);
  });
});
