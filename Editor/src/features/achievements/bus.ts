import type { AchievementEvent } from "./types";

/**
 * 成就显式事件总线
 *
 * 绝大多数成就事件由 listeners 从既有 store 自动推导（业务零侵入）；
 * 仅当某个个性化行为无法从状态推导时（例如彩蛋功能），才在业务点调用
 * emitAchievementEvent 显式发射。
 */

type AchievementEventHandler = (event: AchievementEvent) => void;

const handlers = new Set<AchievementEventHandler>();

export function emitAchievementEvent<T = unknown>(
  type: string,
  payload?: T,
): void {
  const event: AchievementEvent<T> = { type, payload, at: Date.now() };
  handlers.forEach((handler) => handler(event));
}

/**供 listeners 层订阅，勿在业务代码中直接使用 */
export function subscribeAchievementEvents(
  handler: AchievementEventHandler,
): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}
