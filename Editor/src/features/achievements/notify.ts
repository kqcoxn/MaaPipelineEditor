import { notification } from "@/utils/ui/antdAppApi";
import { useAchievementStore } from "@/stores/achievement/achievementStore";
import { celebrateAchievementUnlock } from "./celebrate";
import { achievementDefs } from "./defs";
import type { AchievementDef } from "./types";

/**
 * 成就解锁通知队列
 * 订阅 store 中新产生的解锁，逐个弹出通知，避免一次操作连带解锁
 * 多个成就时同时糊出多个弹窗；每次解锁随机播放一种庆祝动效。
 */

const NOTIFY_DURATION = 4;
const NOTIFY_INTERVAL = 600;

const defMap = new Map<string, AchievementDef>(
  achievementDefs.map((def) => [def.id, def]),
);

export function getAchievementDef(id: string): AchievementDef | undefined {
  return defMap.get(id);
}

function showUnlockNotification(def: AchievementDef): void {
  notification.success({
    title: "成就解锁",
    description: `${def.title} · ${def.description}`,
    placement: "bottomRight",
    duration: NOTIFY_DURATION,
  });
  celebrateAchievementUnlock();
}

/**启动回溯补发的成就汇总提示，不逐个弹窗 */
export function notifyRetroactiveUnlocks(ids: string[]): void {
  if (ids.length === 0) return;
  const titles = ids
    .map((id) => defMap.get(id)?.title)
    .filter(Boolean)
    .join("、");
  notification.info({
    title: "成就补发",
    description: `根据历史使用记录补发 ${ids.length} 个成就：${titles}`,
    placement: "bottomRight",
    duration: NOTIFY_DURATION + 1,
  });
}

export function startUnlockNotifier(): () => void {
  const queue: string[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const pump = () => {
    timer = null;
    const id = queue.shift();
    if (id === undefined) return;
    const def = defMap.get(id);
    if (def) showUnlockNotification(def);
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
      // 延迟一拍弹出，让触发操作的原反馈（如 message）先呈现
      timer = setTimeout(pump, NOTIFY_INTERVAL);
    }
  });

  return () => {
    unsubscribe();
    if (timer !== null) clearTimeout(timer);
    queue.length = 0;
  };
}
