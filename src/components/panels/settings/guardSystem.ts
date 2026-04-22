import { useConfigStore } from "../../../stores/configStore";
import type { ConfigItemDef } from "./settingsDefinitions";
import { settingsDefinitions } from "./settingsDefinitions";

/**守卫检查结果 */
export interface GuardCheckResult {
  /**是否通过（所有守卫项均已配置） */
  passed: boolean;
  /**未配置的配置项定义列表 */
  unconfiguredItems: ConfigItemDef[];
}

/**检查指定动作的守卫
 * @param action 守卫动作标识，如 'export'
 * @returns 守卫检查结果
 */
export function checkGuard(action: string): GuardCheckResult {
  const { configuredKeys } = useConfigStore.getState();

  const guardedItems = settingsDefinitions.filter(
    (item) => item.guardAction === action,
  );

  const unconfiguredItems = guardedItems.filter(
    (item) => !configuredKeys.has(item.key),
  );

  return {
    passed: unconfiguredItems.length === 0,
    unconfiguredItems,
  };
}

/**获取指定动作的所有守卫配置项 */
export function getGuardedItems(action: string): ConfigItemDef[] {
  return settingsDefinitions.filter((item) => item.guardAction === action);
}
