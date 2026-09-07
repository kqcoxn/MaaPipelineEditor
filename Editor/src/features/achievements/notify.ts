import { useAchievementStore } from "@/stores/achievement/achievementStore";
import { achievementDefs } from "./defs";
import type { AchievementDef } from "./types";

/**
 * 成就解锁胶囊队列
 * 订阅 store 中新产生的解锁，逐个交给 AchievementUnlockIsland 展示；
 * 启动回溯补发走单独的汇总胶囊，不逐个弹出。
 */

const NOTIFY_DURATION = 4;
const NOTIFY_INTERVAL = 600;

const defMap = new Map<string, AchievementDef>(
  achievementDefs.map((def) => [def.id, def]),
);

export function getAchievementDef(id: string): AchievementDef | undefined {
  return defMap.get(id);
}

export { NOTIFY_DURATION, NOTIFY_INTERVAL };

/**启动回溯补发的成就汇总提示，不逐个弹胶囊 */
export function notifyRetroactiveUnlocks(ids: string[]): void {
  if (ids.length === 0) return;
  useAchievementStore.getState().setToast({ kind: "retroactive", ids });
}

export function startUnlockNotifier(): () => void {
  const queue: string[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const pump = () => {
    timer = null;
    const id = queue.shift();
    if (id === undefined) return;
    useAchievementStore.getState().setToast({ kind: "unlock", id });
    if (queue.length > 0) {
      timer = setTimeout(pump, (NOTIFY_DURATION + 0.2) * 1000);
    }
  };

  const unsubscribe = useAchievementStore.subscribe((state, prevState) => {
    if (state.unlocked === prevState.unlocked) return;
    const added = Object.keys(state.unlocked).filter(
      (id) => !prevState.unlocked[id],
    );
    if (added.length === 0) return;
    queue.push(...added);
    if (timer === null) {
      // 延迟一拍弹出，让触发操作的原反馈先呈现
      timer = setTimeout(pump, NOTIFY_INTERVAL);
    }
  });

  return () => {
    unsubscribe();
    if (timer !== null) clearTimeout(timer);
    queue.length = 0;
    useAchievementStore.getState().setToast(null);
  };
}
