import { useAchievementStore } from "@/stores/achievement/achievementStore";
import { achievementDefs } from "./defs";
import type { AchievementDef } from "./types";

/**新解锁立即追加为独立胶囊，启动回溯补发使用汇总胶囊。 */
export const NOTIFY_DURATION = 4;

const defMap = new Map<string, AchievementDef>(
  achievementDefs.map((def) => [def.id, def]),
);

export function getAchievementDef(id: string): AchievementDef | undefined {
  return defMap.get(id);
}

/**启动回溯补发的成就汇总提示，不逐个弹胶囊 */
export function notifyRetroactiveUnlocks(ids: string[]): void {
  if (ids.length === 0) return;
  useAchievementStore.getState().addToast({ kind: "retroactive", ids });
}

export function startUnlockNotifier(): () => void {
  const unsubscribe = useAchievementStore.subscribe((state, prevState) => {
    if (state.unlocked === prevState.unlocked) return;
    const added = Object.keys(state.unlocked).filter(
      (id) => !prevState.unlocked[id],
    );
    for (const id of added) {
      useAchievementStore.getState().addToast({ kind: "unlock", id });
    }
  });

  return () => {
    unsubscribe();
    useAchievementStore.getState().clearToasts();
  };
}
