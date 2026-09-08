import { subscribeAchievementActivity } from "./activityListeners";
import {
  initializeAchievementPersistence,
  useAchievementStore,
} from "@/stores/achievement/achievementStore";
import { isEmbedEnvironment } from "@/utils/embedBridge";
import {
  buildEngineIndex,
  evaluateAllAchievements,
  handleAchievementEvent,
  type EngineIndex,
} from "./engine";
import { achievementDefs, counterRules } from "./defs";
import { subscribeAchievementEvents } from "./bus";
import { startUnlockNotifier, notifyRetroactiveUnlocks } from "./notify";
import type { AchievementEvent } from "./types";

/**
 * 成就系统装配层
 * 接收成功操作事件与实时反馈，驱动引擎求值并写回 store。
 * 嵌入模式下不初始化（成就系统整体禁用）。
 */

let engineIndex: EngineIndex | null = null;

function getEngineIndex(): EngineIndex {
  if (!engineIndex) engineIndex = buildEngineIndex(achievementDefs);
  return engineIndex;
}

/**把一个成就事件送入引擎并应用结果 */
function dispatchEvent(event: AchievementEvent): void {
  const state = useAchievementStore.getState();
  const patch = handleAchievementEvent(
    getEngineIndex(),
    counterRules,
    event,
    state.counters,
    state.unlocked,
  );
  if (Object.keys(patch).length > 0) {
    useAchievementStore.getState().applyEnginePatch(patch);
  }
}

/**全量回溯：启动时 / 配置导入后调用，补发历史进度已达标的成就 */
export function reevaluateAchievements(): string[] {
  const state = useAchievementStore.getState();
  const patch = evaluateAllAchievements(
    achievementDefs,
    state.counters,
    state.unlocked,
  );
  if (Object.keys(patch).length === 0) return [];
  useAchievementStore.getState().applyEnginePatch(patch);
  return patch.unlock ?? [];
}

/**初始化成就系统，返回清理函数。嵌入模式直接返回空清理。 */
export function initializeAchievements(): () => void {
  if (isEmbedEnvironment()) return () => undefined;

  const disposePersistence = initializeAchievementPersistence();

  // 启动回溯：先于通知器挂载，补发的解锁不逐个弹胶囊
  const retroactive = reevaluateAchievements();

  const disposeNotifier = startUnlockNotifier();
  if (retroactive.length > 0) {
    notifyRetroactiveUnlocks(retroactive);
  }

  const disposers = [
    disposePersistence,
    disposeNotifier,
    subscribeAchievementActivity(),
    subscribeAchievementEvents(dispatchEvent),
  ];

  return () => {
    disposers.forEach((dispose) => dispose());
  };
}
