import { reconcilePreferences, sanitizeOptionValues, scopeKey, type ProjectPreferences } from "./projectPreferences";
import type { ProjectInterfaceSnapshot } from "./types";
import { compatibleResources, asObjectArray } from "./projectInterfaceState";
import { projectPretasks } from "./pretaskState";

export function moveTask(order: string[], name: string, direction: -1 | 1) {
  const next = [...order];
  const index = next.indexOf(name);
  if (index < 0 || index + direction < 0 || index + direction >= next.length) return next;
  [next[index], next[index + direction]] = [next[index + direction], next[index]];
  return next;
}
export function applyTaskPreset(preferences: ProjectPreferences, snapshot: ProjectInterfaceSnapshot, preset: Record<string, unknown>) {
  if (!compatibleResources([preset], preferences.controllerName).length) return preferences;
  const tasks = Array.isArray(preset.task) ? preset.task as Array<{ name: string; enabled?: boolean; option?: Record<string, unknown> }> : [];
  const values = { ...preferences.values };
  for (const task of tasks) {
    values[scopeKey("task", preferences, task.name)] = sanitizeOptionValues(task.option ?? {}, snapshot.document.option ?? {}, true);
  }
  let pretaskEnabled = preferences.pretaskEnabled;
  if (Array.isArray(preset.pretask)) {
    const programs = projectPretasks(snapshot);
    pretaskEnabled = Object.fromEntries(programs.map(program => [program.id, false]));
    for (const item of asObjectArray(preset.pretask)) {
      const program = programs.find(program => program.name === item.name);
      if (!program) continue;
      pretaskEnabled[program.id] = item.enabled !== false;
      values[scopeKey("pretask", preferences, program.id)] = sanitizeOptionValues(item.option && typeof item.option === "object" ? item.option as Record<string, unknown> : {}, snapshot.document.option ?? {}, true);
    }
  }
  return reconcilePreferences({ ...preferences, values, pretaskEnabled, taskOrder: tasks.map(task => task.name), checkedTaskNames: tasks.filter(task => task.enabled !== false).map(task => task.name) }, snapshot);
}
