import type { AchievementEvent } from "./types";

/**成功操作与实时反馈的轻量事件总线；未初始化成就时不会持久化或通知。 */

type AchievementEventHandler = (event: AchievementEvent) => void;

const handlers = new Set<AchievementEventHandler>();

export function hasAchievementListeners(): boolean {
  return handlers.size > 0;
}

export function emitAchievementEvent<T = unknown>(
  type: string,
  payload?: T,
): void {
  if (!handlers.size) return;
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
