import { reconcilePreferences, sanitizeOptionValues, scopeKey, type ProjectPreferences } from "./projectPreferences";
import type { ProjectInterfaceSnapshot } from "./types";

export function moveTask(order: string[], name: string, direction: -1 | 1) {
  const next = [...order];
  const index = next.indexOf(name);
  if (index < 0 || index + direction < 0 || index + direction >= next.length) return next;
  [next[index], next[index + direction]] = [next[index + direction], next[index]];
  return next;
}
export function applyTaskPreset(preferences: ProjectPreferences, snapshot: ProjectInterfaceSnapshot, preset: Record<string, unknown>) {
  const tasks = Array.isArray(preset.task) ? preset.task as Array<{ name: string; enabled?: boolean; option?: Record<string, unknown> }> : [];
  const values = { ...preferences.values };
  for (const task of tasks) {
    values[scopeKey("task", preferences, task.name)] = sanitizeOptionValues(task.option ?? {}, snapshot.document.option ?? {}, true);
  }
  return reconcilePreferences({ ...preferences, values, taskOrder: tasks.map(task => task.name), checkedTaskNames: tasks.filter(task => task.enabled !== false).map(task => task.name) }, snapshot);
}
